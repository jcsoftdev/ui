import { type DefineOptions, defineElement, ElementBase, emit } from "../internal/base.js";
import { connectLight, defaultAttr } from "../internal/containers.js";
import {
  BRAND_PALETTES,
  generateMark,
  generateVariations,
  MARK_FILLS,
  MARK_LAYOUTS,
  MARK_SHAPES,
  type MarkDescription,
  type MarkOptions,
  serializeMark,
} from "../internal/e15-brand.js";
import { renderMark } from "../internal/e15-brand-dom.js";
import { GLYPHS } from "../internal/e15-brand-glyphs.js";
import { DEFAULT_FORGE_VALUE, forgeOptions, type LogoForgeValue } from "../internal/e15-forge.js";
import { resolveString, watchStrings } from "../internal/strings.js";
import css from "./logo-forge.css.js";

export type { LogoForgeValue } from "../internal/e15-forge.js";

/** English defaults; keys are `logoForge.<key>` in the strings registry (the `es` pack has them all). */
const EN: Record<string, string> = {
  title: "Logo generator",
  name: "Name",
  tagline: "Tagline",
  shape: "Shape",
  "shape.circle": "Circle",
  "shape.squircle": "Squircle",
  "shape.shield": "Shield",
  "shape.hexagon": "Hexagon",
  "shape.badge": "Badge",
  "shape.ribbon": "Ribbon",
  "shape.none": "No shape",
  monogram: "Monogram",
  "monogram.initials": "Initials",
  "monogram.glyph": "Symbol",
  letters: "Letters",
  glyph: "Symbol",
  "glyph.scissors": "Scissors",
  "glyph.comb": "Comb",
  "glyph.razor": "Razor",
  "glyph.pole": "Barber pole",
  "glyph.star": "Star",
  "glyph.leaf": "Leaf",
  "glyph.bolt": "Bolt",
  "glyph.crown": "Crown",
  "glyph.mustache": "Mustache",
  layout: "Layout",
  "layout.icon": "Icon only",
  "layout.horizontal": "Horizontal",
  "layout.stacked": "Stacked",
  fill: "Fill",
  "fill.solid": "Solid",
  "fill.gradient": "Gradient",
  "fill.outline": "Outline",
  palette: "Palette",
  custom: "Custom",
  primary: "Primary",
  secondary: "Secondary",
  ink: "Text",
  primaryColor: "Primary color",
  secondaryColor: "Secondary color",
  inkColor: "Text color",
  weight: "Name weight",
  "weight.400": "Regular",
  "weight.600": "Medium",
  "weight.700": "Bold",
  "weight.800": "Extra",
  tracking: "Spacing",
  trackingLabel: "Letter spacing",
  options: "Options",
  uppercase: "Uppercase",
  ring: "Ring",
  background: "Preview background",
  "background.none": "Transparent",
  "background.light": "Light",
  "background.dark": "Dark",
  downloadSvg: "Download SVG",
  downloadPng: "Download PNG",
  copySvg: "Copy SVG",
  variations: "Variations",
  shuffle: "Shuffle",
  useVariation: "Use variation",
  downloaded: "downloaded",
  copied: "SVG copied to the clipboard",
  failed: "The action could not be completed",
};

type Field = keyof LogoForgeValue;
type Primitive = string | number;

interface ChoiceSpec {
  field: Field;
  label: string;
  options: readonly Primitive[];
  /** Label key for one option, or `undefined` to show the raw value. */
  optionKey?: (option: Primitive) => string | undefined;
  /** Visible only when this returns true. */
  when?: (value: LogoForgeValue) => boolean;
}

const WEIGHTS = [400, 600, 700, 800] as const;
const CHOICES: readonly ChoiceSpec[] = [
  { field: "shape", label: "shape", options: MARK_SHAPES, optionKey: (o) => `shape.${o}` },
  {
    field: "monogram",
    label: "monogram",
    options: ["initials", "glyph"],
    optionKey: (o) => `monogram.${o}`,
  },
  {
    field: "initialsCount",
    label: "letters",
    options: [1, 2, 3],
    when: (v) => v.monogram === "initials",
  },
  {
    field: "layout",
    label: "layout",
    options: MARK_LAYOUTS,
    optionKey: (o) => `layout.${o}`,
  },
  { field: "fill", label: "fill", options: MARK_FILLS, optionKey: (o) => `fill.${o}` },
];

/** Minimal element factory: text goes through `textContent`, never `innerHTML`. */
function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, value);
  element.append(...children);
  return element;
}

const GLYPH_SVG = (parts: (typeof GLYPHS)[number]["parts"]) =>
  `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">${parts
    .map((part) =>
      part.kind === "fill"
        ? `<path d="${part.d}" fill="currentColor"/>`
        : `<path d="${part.d}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join("")}</svg>`;

/**
 * `<ui-logo-forge>`: an interactive brand-mark editor. Pick a shape, monogram or symbol, palette
 * and layout, browse twelve seeded variations (Shuffle pages through more), then download the SVG
 * or PNG or copy the SVG source. Light DOM composite: native buttons, inputs and a range inside a
 * `role="region"`; every choice is a button with `aria-pressed`, and the status line is a polite
 * live region. The marks are generated with the same deterministic maths as `<ui-logo-mark>`.
 *
 * Attributes: `value` (JSON of a partial `LogoForgeValue`, the React `defaultValue`), `label`
 * (accessible name of the region; default from the strings registry). Properties: `value`
 * (get/set a `LogoForgeValue`; a partial is merged over the defaults), `options` (the generator
 * options for the current value, the React `onChange` payload) and `mark`. Event: `change`, fired
 * on every user edit with `detail: { options, value }`. Export buttons load their code on click.
 * Labels come from the strings registry (`logoForge.*`) with English defaults.
 * Style parts: `[data-ui-part="controls" | "preview" | "choice" | "swatch" | "variations"]`.
 */
export class UiLogoForge extends ElementBase {
  static observedAttributes = ["value", "label"];

  #value: LogoForgeValue = { ...DEFAULT_FORGE_VALUE };
  #page = 0;
  #built = false;
  #mark: MarkDescription | undefined;
  #stopStrings?: () => void;
  #status?: HTMLElement;
  #preview?: HTMLElement;
  #variations: HTMLButtonElement[] = [];

  get value(): LogoForgeValue {
    return this.#value;
  }
  set value(value: Partial<LogoForgeValue>) {
    this.#value = { ...DEFAULT_FORGE_VALUE, ...value };
    if (this.#built) this.#sync();
  }

  /** Generator options for the current value. */
  get options(): MarkOptions {
    return forgeOptions(this.#value);
  }

  /** The generated main mark. */
  get mark(): MarkDescription | undefined {
    return this.#mark;
  }

  connectedCallback(): void {
    connectLight(this, "logo-forge", css);
    defaultAttr(this, "role", "region");
    this.#fromAttribute();
    if (!this.#built) this.#build();
    this.#stopStrings = watchStrings(() => this.#relabel());
    this.#relabel();
    this.#sync();
  }

  disconnectedCallback(): void {
    this.#stopStrings?.();
  }

  attributeChangedCallback(name: string): void {
    if (!this.#built) return;
    if (name === "value") {
      this.#fromAttribute();
      this.#sync();
    } else this.#relabel();
  }

  #fromAttribute(): void {
    const raw = this.getAttribute("value");
    if (!raw) return;
    try {
      this.#value = { ...DEFAULT_FORGE_VALUE, ...(JSON.parse(raw) as Partial<LogoForgeValue>) };
    } catch {
      /* an unparseable value keeps the current one */
    }
  }

  #t(key: string): string {
    return resolveString(this, `logoForge.${key}`, EN[key]);
  }

  #update(patch: Partial<LogoForgeValue>): void {
    this.#value = { ...this.#value, ...patch };
    this.#sync();
    emit(this, "change", { options: this.options, value: this.#value });
  }

  /** Text node holder with a label key; `#relabel` fills it. */
  #label<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    key: string,
    target: "text" | "aria" = "text",
    attrs: Record<string, string> = {},
  ): HTMLElementTagNameMap[K] {
    return h(tag, { ...attrs, [target === "text" ? "data-s" : "data-s-aria"]: key });
  }

  #group(labelKey: string, ...content: Node[]): HTMLFieldSetElement {
    return h("fieldset", { "data-ui-part": "group" }, this.#label("legend", labelKey), ...content);
  }

  #choiceButton(field: Field, option: Primitive, key: string | undefined): HTMLButtonElement {
    const button = h("button", {
      type: "button",
      "data-ui-part": "choice",
      "data-field": field,
      "data-value": String(option),
      "aria-pressed": "false",
    });
    if (key) button.dataset.s = key;
    else button.textContent = String(option);
    return button;
  }

  #field(labelKey: string, control: Node): HTMLElement {
    return h("div", { "data-ui-part": "field" }, this.#label("span", labelKey), control);
  }

  #build(): void {
    this.#built = true;
    const text = (field: "name" | "tagline", max: number) => {
      const input = h("input", { type: "text", maxlength: String(max), "data-field": field });
      input.setAttribute("data-s-aria", field);
      input.addEventListener("input", () => this.#update({ [field]: input.value }));
      return this.#field(field, input);
    };

    const groups: HTMLElement[] = [];
    for (const spec of CHOICES) {
      const group = this.#group(
        spec.label,
        h(
          "div",
          { "data-ui-part": "choices" },
          ...spec.options.map((option) =>
            this.#choiceButton(spec.field, option, spec.optionKey?.(option)),
          ),
        ),
      );
      group.dataset.group = spec.field;
      groups.push(group);
      if (spec.field === "monogram") {
        const glyphs = this.#group(
          "glyph",
          h(
            "div",
            { "data-ui-part": "choices" },
            ...GLYPHS.map((glyph) => {
              const button = h("button", {
                type: "button",
                "data-ui-part": "choice",
                "data-kind": "glyph",
                "data-field": "glyph",
                "data-value": glyph.id,
                "aria-pressed": "false",
                "data-s-aria": `glyph.${glyph.id}`,
                "data-s-title": `glyph.${glyph.id}`,
              });
              button.innerHTML = GLYPH_SVG(glyph.parts);
              return button;
            }),
          ),
        );
        glyphs.dataset.group = "glyph";
        groups.push(glyphs);
      }
    }

    const palette = this.#group(
      "palette",
      h(
        "div",
        { "data-ui-part": "choices" },
        ...BRAND_PALETTES.map((p) => {
          const swatch = h("button", {
            type: "button",
            "data-ui-part": "swatch",
            "data-field": "paletteId",
            "data-value": p.id,
            "aria-pressed": "false",
            "aria-label": p.label,
            title: p.label,
          });
          swatch.style.background = `linear-gradient(135deg, ${p.primary} 50%, ${p.secondary} 50%)`;
          return swatch;
        }),
        this.#choiceButton("paletteId", "custom", "custom"),
      ),
    );
    const colors = h(
      "div",
      { "data-ui-part": "colors", "data-group": "custom" },
      ...(["primary", "secondary", "ink"] as const).map((key) => {
        const input = h("input", { type: "color", "data-color": key });
        input.setAttribute("data-s-aria", `${key}Color`);
        input.addEventListener("input", () =>
          this.#update({ custom: { ...this.#value.custom, [key]: input.value } }),
        );
        return h("label", {}, input, this.#label("span", key));
      }),
    );

    const tracking = h("input", {
      type: "range",
      min: "0",
      max: "0.3",
      step: "0.01",
      "data-field": "tracking",
    });
    tracking.setAttribute("data-s-aria", "trackingLabel");
    tracking.addEventListener("input", () => this.#update({ tracking: Number(tracking.value) }));
    const trackingLabel = h("span", { "data-ui-part": "tracking-label" });
    const trackingField = h("div", { "data-ui-part": "field" }, trackingLabel, tracking);
    const toggles = this.#field(
      "options",
      h(
        "div",
        { "data-ui-part": "choices" },
        h("button", {
          type: "button",
          "data-ui-part": "choice",
          "data-toggle": "uppercase",
          "aria-pressed": "false",
          "data-s": "uppercase",
        }),
        h("button", {
          type: "button",
          "data-ui-part": "choice",
          "data-toggle": "ring",
          "aria-pressed": "false",
          "data-s": "ring",
        }),
      ),
    );

    const controls = h(
      "div",
      { "data-ui-part": "controls" },
      h("div", { "data-ui-part": "pair" }, text("name", 60), text("tagline", 80)),
      ...groups,
      palette,
      colors,
      this.#group(
        "weight",
        h(
          "div",
          { "data-ui-part": "choices" },
          ...WEIGHTS.map((w) => this.#choiceButton("weight", w, `weight.${w}`)),
        ),
      ),
      h("div", { "data-ui-part": "pair" }, trackingField, toggles),
    );

    const preview = h("div", { "data-ui-part": "preview" });
    this.#preview = preview;
    const background = this.#group(
      "background",
      h(
        "div",
        { "data-ui-part": "choices" },
        ...(["none", "light", "dark"] as const).map((b) =>
          this.#choiceButton("background", b, `background.${b}`),
        ),
      ),
    );
    const status = h("span", { role: "status", "aria-live": "polite", "data-ui-part": "status" });
    this.#status = status;
    const action = (id: string, key: string) =>
      this.#label("button", key, "text", {
        type: "button",
        "data-ui-part": "action",
        "data-action": id,
      });
    const actions = h(
      "div",
      { "data-ui-part": "actions" },
      action("svg", "downloadSvg"),
      action("png", "downloadPng"),
      action("copy", "copySvg"),
      status,
    );
    const shuffle = this.#label("button", "shuffle", "text", {
      type: "button",
      "data-ui-part": "action",
      "data-action": "shuffle",
    });
    const list = h("ul", { "data-ui-part": "variations" });
    for (let i = 0; i < 12; i += 1) {
      const button = h("button", {
        type: "button",
        "data-ui-part": "variation",
        "aria-pressed": "false",
      });
      this.#variations.push(button);
      list.append(h("li", {}, button));
    }
    this.replaceChildren(
      h(
        "div",
        { "data-ui-part": "top" },
        controls,
        h("div", { "data-ui-part": "side" }, preview, background, actions),
      ),
      h(
        "div",
        { "data-ui-part": "more" },
        h("div", { "data-ui-part": "more-head" }, this.#label("h3", "variations"), shuffle),
        list,
      ),
    );

    this.addEventListener("click", (event) => this.#onClick(event));
  }

  #onClick(event: Event): void {
    const target = (event.target as Element).closest<HTMLElement>("button");
    if (!target || !this.contains(target)) return;
    const { field, value, toggle, action } = target.dataset;
    if (field && value !== undefined) {
      const current = this.#value[field as Field];
      const parsed = typeof current === "number" ? Number(value) : value;
      this.#update({ [field]: parsed } as Partial<LogoForgeValue>);
    } else if (toggle === "uppercase") this.#update({ uppercase: !this.#value.uppercase });
    else if (toggle === "ring") this.#update({ ring: this.#value.ring !== true });
    else if (target.dataset.uiPart === "variation") this.#pick(Number(target.dataset.index));
    else if (action === "shuffle") {
      this.#page += 1;
      this.#sync();
    } else if (action) void this.#run(action);
  }

  #pick(index: number): void {
    const variant = generateVariations(this.options, 12, this.#page)[index];
    if (!variant) return;
    this.#update({
      shape: variant.shape ?? this.#value.shape,
      monogram: variant.monogram ?? this.#value.monogram,
      glyph: variant.glyph ?? this.#value.glyph,
      paletteId: typeof variant.palette === "string" ? variant.palette : this.#value.paletteId,
      fill: variant.fill ?? this.#value.fill,
      seed: variant.seed ?? 0,
      ring: undefined,
    });
  }

  async #run(action: string): Promise<void> {
    const mark = this.#mark ?? generateMark(this.options);
    const svg = serializeMark(mark);
    try {
      const files = await import("../internal/e15-brand-export.js");
      const slug = files.fileSlug(this.#value.name);
      let message: string;
      if (action === "svg") {
        files.downloadBlob(files.svgBlob(svg), `${slug}.svg`);
        message = `${slug}.svg ${this.#t("downloaded")}`;
      } else if (action === "png") {
        files.downloadBlob(
          await files.svgToPngBlob(svg, mark.width, mark.height, 4),
          `${slug}.png`,
        );
        message = `${slug}.png ${this.#t("downloaded")}`;
      } else {
        const { copyText } = await import("@jcsoftdev/ui-core/clipboard");
        await copyText(svg);
        message = this.#t("copied");
      }
      if (this.#status) this.#status.textContent = message;
    } catch {
      if (this.#status) this.#status.textContent = this.#t("failed");
    }
  }

  /** Localized text: every `[data-s]`, `[data-s-aria]` and `[data-s-title]` element. */
  #relabel(): void {
    this.setAttribute("aria-label", this.getAttribute("label") ?? this.#t("title"));
    for (const element of this.querySelectorAll<HTMLElement>("[data-s]"))
      element.textContent = this.#t(element.dataset.s as string);
    for (const element of this.querySelectorAll<HTMLElement>("[data-s-aria]"))
      element.setAttribute("aria-label", this.#t(element.dataset.sAria as string));
    for (const element of this.querySelectorAll<HTMLElement>("[data-s-title]"))
      element.title = this.#t(element.dataset.sTitle as string);
    this.#syncTracking();
    this.#syncVariationLabels();
  }

  #syncTracking(): void {
    const label = this.querySelector('[data-ui-part="tracking-label"]');
    if (label) label.textContent = `${this.#t("tracking")} (${this.#value.tracking.toFixed(2)} em)`;
  }

  #syncVariationLabels(): void {
    this.#variations.forEach((button) => {
      button.setAttribute(
        "aria-label",
        `${this.#t("useVariation")} ${button.dataset.seed ?? ""}`.trim(),
      );
    });
  }

  #sync(): void {
    const value = this.#value;
    const options = this.options;
    const mark = generateMark(options);
    this.#mark = mark;
    for (const input of this.querySelectorAll<HTMLInputElement>("input[data-field]")) {
      const next = String(value[input.dataset.field as Field]);
      if (input.value !== next) input.value = next;
    }
    for (const input of this.querySelectorAll<HTMLInputElement>("input[data-color]")) {
      const next = value.custom[input.dataset.color as "primary"];
      if (input.value !== next) input.value = next;
    }
    for (const button of this.querySelectorAll<HTMLButtonElement>("button[data-field]"))
      button.setAttribute(
        "aria-pressed",
        String(String(value[button.dataset.field as Field]) === button.dataset.value),
      );
    for (const button of this.querySelectorAll<HTMLButtonElement>("button[data-toggle]")) {
      const on = button.dataset.toggle === "uppercase" ? value.uppercase : value.ring === true;
      button.setAttribute("aria-pressed", String(on));
    }
    const show = (name: string, visible: boolean) => {
      const element = this.querySelector<HTMLElement>(`[data-group="${name}"]`);
      if (element) element.hidden = !visible;
    };
    show("initialsCount", value.monogram === "initials");
    show("glyph", value.monogram === "glyph");
    show("custom", value.paletteId === "custom");
    this.#syncTracking();

    this.#preview?.replaceChildren(renderMark(mark, "min(100%, 420px)"));
    const variants = generateVariations(options, 12, this.#page);
    this.#variations.forEach((button, index) => {
      const variant = variants[index] as MarkOptions;
      button.dataset.index = String(index);
      button.dataset.seed = String(variant.seed);
      button.setAttribute("aria-pressed", String(variant.seed === value.seed));
      button.replaceChildren(renderMark(generateMark({ ...variant, layout: "icon" }), "82%"));
    });
    this.#syncVariationLabels();
  }
}

/** Registers `<ui-logo-forge>` (or `<prefix-logo-forge>`) and returns the tag. */
export function defineLogoForge(options?: DefineOptions): string {
  return defineElement("logo-forge", UiLogoForge, options);
}
