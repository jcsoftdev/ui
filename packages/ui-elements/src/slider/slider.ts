import {
  clampValue,
  createPointerDrag,
  keyboardValue,
  nearestThumb,
  type PointerDrag,
  type RangeValue,
  ratioOf,
  setRangeThumb,
  snapToStep,
  valueFromRatio,
} from "@jcsoftdev/ui-core/pointer-drag";
import { adoptStyles, type DefineOptions, defineElement } from "../internal/base.js";
import { controlName, inlineRatio, numberAttr } from "../internal/e5-forms.js";
import { FormElement } from "../internal/form.js";
import css from "./slider.css.js";

export interface SliderMark {
  value: number;
  label?: string;
}

type Index = 0 | 1;

/** `"0:Low,50,100:High"` to marks. */
function parseMarks(text: string | null): SliderMark[] {
  return (text ?? "")
    .split(",")
    .map((item) => {
      const [value, ...label] = item.split(":");
      return { value: Number(value), label: label.join(":").trim() || undefined };
    })
    .filter((mark) => Number.isFinite(mark.value));
}

/**
 * `<ui-slider>`: single or range slider (WAI-ARIA slider pattern, one `role="slider"` per thumb).
 * Pointer drag comes from ui-core; ratios are physical, so RTL is mirrored here. Arrows (mirrored
 * in RTL), PageUp/PageDown, Home and End move a focused thumb.
 *
 * The value is the number as text (`"50"`), or `"20,80"` for a range, which is on when the `range`
 * attribute is set or the value holds a comma. A range submits `${name}-min` and `${name}-max`
 * (as in the React kit); a single slider submits `name`. `valueAsNumber` is the last thumb and
 * `values` the pair.
 *
 * Attributes: `value`, `name`, `min` (0), `max` (100), `step` (1), `page-step` (10 steps),
 * `min-gap`, `range`, `show-value`, `marks` (`"0:Low,50,100:High"`), `aria-label`, `label`,
 * `disabled`. Properties: `marks` (array), `formatValue(number) => string`. Events: `input`
 * while moving, `change` when a drag ends or a key moves a thumb.
 */
export class UiSlider extends FormElement {
  static override observedAttributes = [
    ...FormElement.observedAttributes,
    "min",
    "max",
    "step",
    "page-step",
    "min-gap",
    "range",
    "show-value",
    "marks",
    "aria-label",
    "label",
    "aria-labelledby",
  ];

  /** Text of the number shown in a thumb bubble and read as `aria-valuetext`. */
  formatValue: (value: number) => string = String;

  readonly #root: HTMLElement;
  readonly #track: HTMLElement;
  readonly #drag: PointerDrag;
  #marks: SliderMark[] | undefined;
  #shape = "";
  #dragging: Index | null = null;
  #focused: Index | null = null;
  #moved = false;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open", delegatesFocus: true });
    adoptStyles(root, css);
    root.innerHTML = '<div part="root"><div part="track"></div></div>';
    this.#root = root.querySelector("[part=root]") as HTMLElement;
    this.#track = root.querySelector("[part=track]") as HTMLElement;
    this.#track.addEventListener("keydown", (event) => this.#onKey(event));
    this.#track.addEventListener("focusin", (event) => this.#onFocus(event, true));
    this.#track.addEventListener("focusout", (event) => this.#onFocus(event, false));
    this.#drag = createPointerDrag(this.#track, {
      disabled: () => this.disabled,
      bounds: () => this.#track,
      onStart: (point) => {
        const { min, max, step } = this.#limits;
        const target = valueFromRatio(inlineRatio(this, point.ratioX), min, max, step);
        const index: Index = this.range ? nearestThumb(this.#pair, target) : 1;
        this.#dragging = index;
        this.#moved = false;
        this.#move(index, target);
        this.render();
        this.#thumb(index)?.focus();
        return undefined;
      },
      onMove: (point) => {
        if (this.#dragging === null) return;
        const { min, max, step } = this.#limits;
        this.#move(this.#dragging, valueFromRatio(inlineRatio(this, point.ratioX), min, max, step));
      },
      onEnd: () => {
        this.#dragging = null;
        this.#fireChange();
        this.render();
      },
    });
  }

  /** Two thumbs: the `range` attribute, or a value that holds a comma. */
  get range(): boolean {
    return this.hasAttribute("range") || super.value.includes(",");
  }
  /** The last thumb's value. */
  get valueAsNumber(): number {
    return this.#pair[1];
  }
  /** `[low, high]`; a single slider is `[min, value]`, as in the React kit. */
  get values(): RangeValue {
    return this.#pair;
  }
  get marks(): SliderMark[] {
    return this.#marks ?? parseMarks(this.getAttribute("marks"));
  }
  set marks(marks: SliderMark[]) {
    this.#marks = marks;
    this.update();
  }

  override get value(): string {
    return this.#text(this.#pair);
  }
  override set value(value: string) {
    super.value = value;
  }

  disconnectedCallback(): void {
    this.#drag.cancel();
  }

  protected override update(): void {
    super.update();
    const { name } = this;
    if (!name) this.internals.setFormValue(null);
    else if (this.range) {
      const data = new FormData();
      data.append(`${name}-min`, String(this.#pair[0]));
      data.append(`${name}-max`, String(this.#pair[1]));
      this.internals.setFormValue(data);
    } else this.internals.setFormValue(String(this.#pair[1]));
  }

  protected override validate(): undefined {
    return undefined;
  }

  protected render(): void {
    const { min, max } = this.#limits;
    const range = this.range;
    const marks = this.marks;
    const showValue = this.hasAttribute("show-value");
    const shape = `${range}|${showValue}|${JSON.stringify(marks)}`;
    if (shape !== this.#shape) {
      this.#shape = shape;
      this.#build(range, showValue, marks);
    }
    const pair = this.#pair;
    const disabled = this.disabled;
    const lo = ratioOf(pair[0], min, max);
    const hi = ratioOf(pair[1], min, max);
    const start = range ? lo : 0;
    const bar = this.#track.querySelector<HTMLElement>("[part=range]") as HTMLElement;
    bar.style.insetInlineStart = `${start * 100}%`;
    bar.style.inlineSize = `${(hi - start) * 100}%`;
    this.#root.toggleAttribute("data-disabled", disabled);
    this.#root.toggleAttribute("data-show-value", showValue);
    this.#root.toggleAttribute(
      "data-labels",
      marks.some((mark) => mark.label),
    );

    const name = controlName(this, this.internals.labels as NodeListOf<HTMLLabelElement>);
    const { minGap } = this.#limits;
    for (const thumb of this.#track.querySelectorAll<HTMLElement>("[data-thumb]")) {
      const index = Number(thumb.dataset.thumb) as Index;
      const value = pair[index];
      thumb.style.insetInlineStart = `${ratioOf(value, min, max) * 100}%`;
      thumb.tabIndex = disabled ? -1 : 0;
      thumb.toggleAttribute("data-active", this.#dragging === index || this.#focused === index);
      thumb.setAttribute(
        "aria-label",
        range && name ? `${name} (${index === 0 ? "min" : "max"})` : name,
      );
      thumb.setAttribute("aria-valuemin", String(range && index === 1 ? pair[0] + minGap : min));
      thumb.setAttribute("aria-valuemax", String(range && index === 0 ? pair[1] - minGap : max));
      thumb.setAttribute("aria-valuenow", String(value));
      thumb.setAttribute("aria-valuetext", this.formatValue(value));
      if (disabled) thumb.setAttribute("aria-disabled", "true");
      else thumb.removeAttribute("aria-disabled");
      const bubble = thumb.querySelector("[part=value]");
      if (bubble) bubble.textContent = this.formatValue(value);
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // Labels parsed after the element are only known once the parser has moved on.
    queueMicrotask(() => this.update());
  }

  get #limits() {
    const min = numberAttr(this, "min", 0);
    const max = Math.max(min, numberAttr(this, "max", 100));
    const step = numberAttr(this, "step", 1);
    return {
      min,
      max,
      step,
      page: numberAttr(this, "page-step", step * 10),
      minGap: Math.max(0, numberAttr(this, "min-gap", 0)),
    };
  }

  /** The value as `[low, high]`, snapped into the limits. */
  get #pair(): RangeValue {
    const { min, max, step } = this.#limits;
    const snap = (value: number) => snapToStep(value, min, max, step);
    const parts = super.value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map(Number)
      .filter(Number.isFinite);
    if (this.range) {
      const low = parts.length > 1 ? snap(parts[0] as number) : min;
      const high = snap(parts.length > 1 ? (parts[1] as number) : (parts[0] ?? max));
      return [Math.min(low, high), high];
    }
    return [min, snap(parts[0] ?? min)];
  }

  #text(pair: RangeValue): string {
    return this.range ? `${pair[0]},${pair[1]}` : String(pair[1]);
  }

  #thumb(index: Index): HTMLElement | null {
    return this.#track.querySelector<HTMLElement>(`[data-thumb="${index}"]`);
  }

  #build(range: boolean, showValue: boolean, marks: SliderMark[]): void {
    const { min, max } = this.#limits;
    const mark = (item: SliderMark) =>
      `<span part="mark" aria-hidden="true" style="inset-inline-start:${ratioOf(item.value, min, max) * 100}%"><i></i>${
        item.label ? `<span part="mark-label"></span>` : ""
      }</span>`;
    const thumb = (index: Index) =>
      `<span part="thumb" role="slider" aria-orientation="horizontal" data-thumb="${index}">${
        showValue ? '<span part="value" aria-hidden="true"></span>' : ""
      }</span>`;
    this.#track.innerHTML = `<div part="rail"></div><div part="range"></div>${marks.map(mark).join("")}${
      range ? thumb(0) + thumb(1) : thumb(1)
    }`;
    this.#track.querySelectorAll("[part=mark-label]").forEach((label, at) => {
      label.textContent = marks.filter((item) => item.label)[at]?.label ?? "";
    });
  }

  #move(index: Index, raw: number): void {
    const { min, max, step, minGap } = this.#limits;
    const current = this.#pair;
    const next = this.range
      ? setRangeThumb(current, index, raw, min, max, step, minGap)
      : ([min, snapToStep(raw, min, max, step)] as RangeValue);
    if (next[0] === current[0] && next[1] === current[1]) return;
    this.value = this.#text(next);
    this.#moved = true;
    this.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  }

  #fireChange(): void {
    if (!this.#moved) return;
    this.#moved = false;
    this.dispatchEvent(new Event("change", { bubbles: true }));
  }

  #onKey(event: KeyboardEvent): void {
    const thumb = (event.target as Element).closest<HTMLElement>("[data-thumb]");
    if (!thumb || this.disabled || event.altKey || event.ctrlKey || event.metaKey) return;
    const index = Number(thumb.dataset.thumb) as Index;
    const { min, max, step, page } = this.#limits;
    const dir = getComputedStyle(this).direction === "rtl" ? "rtl" : "ltr";
    const next = keyboardValue(event.key, this.#pair[index], min, max, step, page, dir);
    if (next === null) return;
    event.preventDefault();
    this.#move(index, clampValue(next, min, max));
    this.#fireChange();
  }

  #onFocus(event: FocusEvent, focused: boolean): void {
    const thumb = (event.target as Element).closest<HTMLElement>("[data-thumb]");
    if (!thumb) return;
    this.#focused = focused ? (Number(thumb.dataset.thumb) as Index) : null;
    this.render();
  }
}

/** Registers `<ui-slider>` (or `<prefix-slider>`) and returns the tag. */
export function defineSlider(options?: DefineOptions): string {
  return defineElement("slider", UiSlider, options);
}
