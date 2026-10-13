/// <reference types="@vitest/browser-playwright" />
import { act, type ComponentProps, type CSSProperties, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cdp, page, userEvent } from "vitest/browser";
import "../../test/glass-browser.css";
import { Card } from "../containers/card/card.js";
import { Dialog, DialogContent, DialogTitle } from "../overlays/dialog/dialog.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../overlays/dropdown-menu/dropdown-menu.js";
import { Popover, PopoverContent, PopoverTrigger } from "../overlays/popover/popover.js";
import type { Material } from "../utils/material.js";
import { startLiquidGlass } from "./liquid-glass.js";
import {
  LIQUID_PRESETS,
  type LiquidGlassOptions,
  type LiquidPresetName,
  liquidStyle,
  mergeLiquid,
} from "./liquid-options.js";
import { applyGlassRefraction } from "./refraction.js";

/** A material with options, as the tests describe it: the string material plus `liquidStyle()`. */
type Spec =
  | Material
  | undefined
  | ({ type: "liquid" | "liquid-clear"; preset?: LiquidPresetName } & LiquidGlassOptions);
const surfaceProps = (spec: Spec): { material?: Material; style?: CSSProperties } => {
  if (typeof spec !== "object") return { material: spec };
  const { type, preset, ...options } = spec;
  return {
    material: type,
    style: liquidStyle(preset ? mergeLiquid(LIQUID_PRESETS[preset], options) : options),
  };
};

/** The lens is opt-in (`<LiquidGlass />` in an app): the describes about the lens turn it on. */
function withLiquidGlass() {
  let stop: (() => void) | undefined;
  beforeEach(() => {
    stop = startLiquidGlass();
  });
  afterEach(() => stop?.());
}

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Busy backdrop: hard black/white stripes, the worst case for text legibility. */
const STRIPES =
  "repeating-linear-gradient(90deg, #000 0 6px, #fff 6px 12px), repeating-linear-gradient(0deg, #f0f 0 9px, #0ff 9px 18px)";

let root: Root | undefined;
let host: HTMLElement | undefined;

async function mount(node: ReactNode, attrs: Record<string, string> = {}) {
  host = document.createElement("div");
  host.style.cssText = `position:relative;width:420px;height:240px;background:${STRIPES};background-blend-mode:difference`;
  for (const [k, v] of Object.entries(attrs)) host.setAttribute(k, v);
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root?.render(node));
  return host;
}

const emulate = (features: { name: string; value: string }[]) =>
  cdp().send("Emulation.setEmulatedMedia", { features });

afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  root = host = undefined;
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.style;
  await emulate([]);
});

const glassBox = (cls: string, extra: ReactNode = null) => (
  <div data-testid="box" className={`${cls} absolute inset-8 rounded-dialog text-ink`}>
    {extra}
  </div>
);
const styleOf = (el: Element) => getComputedStyle(el);
const alpha = (color: string) => {
  const m = /\/\s*([\d.]+)\)|rgba?\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/.exec(color);
  return m ? Number(m[1] ?? m[2]) : 1;
};
const channels = (color: string) => (color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
const lum = ([r, g, b]: number[]) => {
  const f = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r ?? 0) + 0.7152 * f(g ?? 0) + 0.0722 * f(b ?? 0);
};
const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

async function pixels(el: Element): Promise<number[][]> {
  const shot = (await page.elementLocator(el).screenshot({ save: false } as never)) as unknown;
  const base64 = typeof shot === "string" ? shot : (shot as { base64: string }).base64;
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  ctx.drawImage(bitmap, 0, 0);
  // Sample the inner 60% of the box: where text sits, away from the lensing rim.
  const x0 = Math.floor(bitmap.width * 0.2);
  const y0 = Math.floor(bitmap.height * 0.2);
  const data = ctx.getImageData(
    x0,
    y0,
    Math.floor(bitmap.width * 0.6),
    Math.floor(bitmap.height * 0.6),
  ).data;
  const out: number[][] = [];
  for (let i = 0; i < data.length; i += 4)
    out.push([data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0]);
  return out;
}

describe("materials render as glass", () => {
  test("glass blurs and tints; the hairline edge and specular highlight are in the shadow", async () => {
    const h = await mount(glassBox("glass"));
    const s = styleOf(h.querySelector("[data-testid=box]") as Element);
    expect(s.backdropFilter).toContain("blur(20px)");
    expect(alpha(s.backgroundColor)).toBeLessThan(1);
    expect(s.boxShadow).toContain("inset");
  });

  test("glass-clear blurs less than regular and carries a dimming layer", async () => {
    const h = await mount(glassBox("glass-clear"));
    const s = styleOf(h.querySelector("[data-testid=box]") as Element);
    expect(s.backdropFilter).toContain("blur(10px)");
    expect(s.backgroundImage).toContain("linear-gradient");
  });

  test("surface-card never blurs, even in the glass preset", async () => {
    const h = await mount(glassBox("surface-card"), { "data-style": "glass" });
    const box = h.querySelector("[data-testid=box]") as Element;
    expect(styleOf(box).backdropFilter).toBe("none");
    expect(alpha(styleOf(box).backgroundColor)).toBe(1);
  });

  test("surface-overlay becomes glass in the glass preset and stays solid otherwise", async () => {
    const solid = await mount(glassBox("surface-overlay"));
    expect(styleOf(solid.querySelector("[data-testid=box]") as Element).backdropFilter).toBe(
      "none",
    );
    await act(async () => root?.unmount());
    solid.remove();
    const glass = await mount(glassBox("surface-overlay"), { "data-style": "glass" });
    const s = styleOf(glass.querySelector("[data-testid=box]") as Element);
    expect(s.backdropFilter).toContain("blur(24px)");
  });

  test("a Card is solid by default and opts into glass with material", async () => {
    const h = await mount(
      <>
        <Card data-testid="plain" />
        <Card data-testid="glass" material="glass" />
        <Card data-testid="clear" material="glass-clear" />
      </>,
    );
    expect(styleOf(h.querySelector("[data-testid=plain]") as Element).backdropFilter).toBe("none");
    expect(styleOf(h.querySelector("[data-testid=glass]") as Element).backdropFilter).toContain(
      "blur",
    );
    expect(styleOf(h.querySelector("[data-testid=clear]") as Element).backdropFilter).toContain(
      "blur(10px)",
    );
  });

  test("glass inside glass drops its blur and turns near-solid", async () => {
    const h = await mount(
      glassBox("glass", <div data-testid="inner" className="glass absolute inset-4" />),
    );
    const inner = styleOf(h.querySelector("[data-testid=inner]") as Element);
    expect(inner.backdropFilter).toBe("none");
    expect(alpha(inner.backgroundColor)).toBeGreaterThan(0.9);
  });
});

describe("portaled overlays opened from glass", () => {
  // Portals land in <body>, outside the mounted host, so the preset goes on the root.
  beforeEach(() => {
    document.documentElement.dataset.style = "glass";
  });
  const clickByText = async (text: string) => {
    const el = [...document.querySelectorAll("button")].find((b) => b.textContent === text);
    await userEvent.click(el as Element);
    await new Promise((r) => setTimeout(r, 50));
  };
  const menu = () => document.querySelector("[role=menu]") as HTMLElement;

  test("a menu opened from a glass dialog has no backdrop-filter of its own", async () => {
    await mount(
      <Dialog open>
        <DialogContent material="glass" aria-describedby={undefined}>
          <DialogTitle>Glass dialog</DialogTitle>
          <DropdownMenu>
            <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>One</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </DialogContent>
      </Dialog>,
    );
    await clickByText("Open menu");
    expect(menu()).not.toBeNull();
    expect(menu().closest("[role=dialog]")).toBeNull();
    expect(menu().hasAttribute("data-glass-nested")).toBe(true);
    expect(styleOf(menu()).backdropFilter).toBe("none");
    expect(alpha(styleOf(menu()).backgroundColor)).toBeGreaterThan(0.9);
  });

  test("a focused menu takes the glass outline under more contrast and none otherwise", async () => {
    document.documentElement.dataset.style = "glass";
    document.documentElement.dataset.theme = "dark";
    await mount(
      <DropdownMenu>
        <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>One</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    await clickByText("Open menu");
    await userEvent.keyboard("{Shift}");
    menu().focus();
    expect(styleOf(menu()).outlineStyle).toBe("none");
    await emulate([{ name: "prefers-contrast", value: "more" }]);
    await vi.waitFor(() => {
      expect(styleOf(menu()).outlineStyle).toBe("solid");
      expect(Number.parseFloat(styleOf(menu()).outlineWidth)).toBeGreaterThanOrEqual(1);
    });
    await emulate([{ name: "forced-colors", value: "active" }]);
    await vi.waitFor(() => expect(styleOf(menu()).outlineStyle).toBe("solid"));
  });

  test("a menu opened from plain content keeps its glass", async () => {
    await mount(
      <DropdownMenu>
        <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>One</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    await clickByText("Open menu");
    expect(menu().hasAttribute("data-glass-nested")).toBe(false);
    expect(styleOf(menu()).backdropFilter).toContain("blur");
  });

  test("a popover opened from a glass dialog is marked too", async () => {
    await mount(
      <Dialog open>
        <DialogContent material="glass" aria-describedby={undefined}>
          <DialogTitle>Glass dialog</DialogTitle>
          <Popover>
            <PopoverTrigger>Open popover</PopoverTrigger>
            <PopoverContent>Hello</PopoverContent>
          </Popover>
        </DialogContent>
      </Dialog>,
    );
    await clickByText("Open popover");
    const pop = [...document.querySelectorAll("[data-glass-nested]")].find(
      (e) => e.textContent === "Hello",
    );
    expect(pop).toBeDefined();
    expect(styleOf(pop as Element).backdropFilter).toBe("none");
  });
});

describe("popper content nested in a liquid surface", () => {
  withLiquidGlass();
  test("a popover and a menu opened from a liquid dialog stay opaque and are never lensed", async () => {
    await mount(
      <Dialog open>
        <DialogContent material="liquid" aria-describedby={undefined}>
          <DialogTitle>Liquid dialog</DialogTitle>
          <Popover>
            <PopoverTrigger>Open popover</PopoverTrigger>
            <PopoverContent>Hello</PopoverContent>
          </Popover>
        </DialogContent>
      </Dialog>,
    );
    await vi.waitFor(() =>
      expect(document.querySelectorAll("#ui-glass-refraction-defs filter").length).toBe(1),
    );
    const trigger = [...document.querySelectorAll("button")].find(
      (b) => b.textContent === "Open popover",
    );
    await userEvent.click(trigger as Element);
    await new Promise((r) => setTimeout(r, 150));
    const pop = [...document.querySelectorAll("[data-glass-nested]")].find(
      (e) => e.textContent === "Hello",
    ) as HTMLElement;
    expect(pop).toBeDefined();
    expect(styleOf(pop).backdropFilter).toBe("none");
    expect(styleOf(pop).getPropertyValue("--glass-lens").trim()).toBe("0");
    expect(pop.dataset.glassRefraction).toBeUndefined();
    expect(document.querySelectorAll("#ui-glass-refraction-defs filter").length).toBe(1);
  });
});

describe("accessibility fallbacks", () => {
  test("reduced transparency, more contrast and forced colors make glass opaque", async () => {
    const h = await mount(glassBox("glass"));
    const box = h.querySelector("[data-testid=box]") as Element;
    for (const feature of [
      { name: "prefers-reduced-transparency", value: "reduce" },
      { name: "prefers-contrast", value: "more" },
      { name: "forced-colors", value: "active" },
    ]) {
      await emulate([feature]);
      const s = styleOf(box);
      expect(s.backdropFilter, feature.name).toBe("none");
      expect(alpha(s.backgroundColor), feature.name).toBe(1);
    }
    await emulate([{ name: "forced-colors", value: "active" }]);
    expect(styleOf(box).outlineStyle).toBe("solid");
  });

  test("clear glass falls back too", async () => {
    const h = await mount(glassBox("glass-clear"));
    await emulate([{ name: "prefers-reduced-transparency", value: "reduce" }]);
    const s = styleOf(h.querySelector("[data-testid=box]") as Element);
    expect(s.backdropFilter).toBe("none");
    expect(alpha(s.backgroundColor)).toBe(1);
  });
});

const BACKDROPS = {
  white: "#fff",
  black: "#000",
  split: "linear-gradient(90deg, #000 50%, #fff 50%)",
  stripes: STRIPES,
} as const;

/** Contrast of `colors` against every sampled backdrop pixel of an empty panel. */
async function worstContrast(
  panelClass: string,
  backdrop: string,
  colors: string[],
  attrs: Record<string, string> = {},
) {
  host = document.createElement("div");
  host.style.cssText = `position:relative;width:600px;height:300px;background:${backdrop}`;
  for (const [k, v] of Object.entries(attrs)) host.setAttribute(k, v);
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(
      <div
        data-testid="box"
        className={`${panelClass} absolute rounded-dialog`}
        style={{ left: 60, top: 40, width: 480, height: 220 }}
      />,
    );
  });
  const box = host.querySelector("[data-testid=box]") as Element;
  const samples = await pixels(box);
  return colors.map((cls) => {
    const probe = document.createElement("span");
    probe.className = cls;
    box.appendChild(probe);
    const ink = lum(channels(styleOf(probe).color));
    probe.remove();
    return Math.min(...samples.map((p) => contrast(ink, lum(p))));
  });
}

describe("non-glass presets are unchanged (0.2.0 behaviour)", () => {
  const MEDIA = {
    normal: [],
    "reduced-transparency": [{ name: "prefers-reduced-transparency", value: "reduce" }],
    "more-contrast": [{ name: "prefers-contrast", value: "more" }],
    "forced-colors": [{ name: "forced-colors", value: "active" }],
  } as const;
  const PRESETS = ["soft", "bordered", "elevated", "flat", "brutal"];
  // What each utility resolved to in 0.2.0: the surface's own token, no blur, no outline.
  const LEGACY = [
    ["surface-overlay", "--surface-overlay"],
    ["surface-nav", "--bg"],
    ["surface-side", "--surface"],
  ] as const;

  for (const theme of ["light", "dark"] as const) {
    for (const preset of PRESETS) {
      for (const [media, features] of Object.entries(MEDIA)) {
        test(`${preset}/${theme}/${media}: chrome surfaces equal their 0.2.0 values`, async () => {
          document.documentElement.dataset.theme = theme;
          await emulate([...features]);
          const h = await mount(
            <>
              {LEGACY.map(([cls]) => (
                <div key={cls} data-testid={cls} className={cls}>
                  <div data-testid={`${cls}-nested`} className="surface-overlay" />
                </div>
              ))}
              <div
                data-testid="ref-overlay"
                style={{ backgroundColor: "var(--surface-overlay)" }}
              />
              <div data-testid="ref-bg" style={{ backgroundColor: "var(--bg)" }} />
              <div data-testid="ref-surface" style={{ backgroundColor: "var(--surface)" }} />
            </>,
            { "data-style": preset },
          );
          const get = (id: string) => styleOf(h.querySelector(`[data-testid=${id}]`) as Element);
          const refs: Record<string, string> = {
            "surface-overlay": "ref-overlay",
            "surface-nav": "ref-bg",
            "surface-side": "ref-surface",
          };
          for (const [cls] of LEGACY) {
            const s = get(cls);
            const ref = get(refs[cls] as string);
            expect(s.backgroundColor, `${cls} background`).toBe(ref.backgroundColor);
            expect(s.backdropFilter, `${cls} backdrop-filter`).toBe("none");
            expect(s.backgroundImage, `${cls} background-image`).toBe("none");
            expect(s.outlineStyle, `${cls} outline`).toBe("none");
            // A surface-overlay nested in any chrome surface stays the plain overlay fill.
            const nested = get(`${cls}-nested`);
            expect(nested.backgroundColor, `${cls} nested background`).toBe(
              get("ref-overlay").backgroundColor,
            );
            expect(nested.backdropFilter, `${cls} nested backdrop-filter`).toBe("none");
          }
        });
      }
    }
  }
});

describe("glass nested in any glass or chrome surface drops its blur", () => {
  for (const outer of ["glass", "glass-clear", "surface-overlay", "surface-nav", "surface-side"]) {
    for (const inner of [
      "glass",
      "glass-clear",
      "surface-overlay",
      "surface-nav",
      "surface-side",
    ]) {
      test(`${inner} inside ${outer}`, async () => {
        const h = await mount(
          <div className={outer}>
            <div data-testid="inner" className={inner} />
          </div>,
          { "data-style": "glass" },
        );
        const s = styleOf(h.querySelector("[data-testid=inner]") as Element);
        expect(s.backdropFilter).toBe("none");
        expect(alpha(s.backgroundColor)).toBeGreaterThan(0.9);
      });
    }
  }
});

describe("legibility over a worst-case backdrop", () => {
  // Menus, popovers and the top bar are regular glass in the glass preset; clear glass is the
  // explicit opt-in. All of them keep text-ink and text-ink-2 at 4.5:1 on white, black, a hard
  // half-and-half split and fine stripes.
  const panels = [
    ["glass", {}],
    ["glass-clear", {}],
    ["liquid", {}],
    ["liquid-clear", {}],
    ["glass", { "data-glass": "liquid" }],
    ["surface-overlay", { "data-style": "glass", "data-glass": "liquid" }],
    ["surface-overlay", { "data-style": "glass" }],
    ["surface-nav", { "data-style": "glass" }],
  ] as const;
  // Frosted and chrome surfaces keep 4.8:1 (4.5 required) for both inks. Liquid glass trades
  // veil for transparency, so its floors are lower and documented: regular keeps text-ink at 4.5:1
  // and text-ink-2 at 3.5:1, clear keeps text-ink at 4.5:1 and text-ink-2 at 2:1 (use regular
  // glass for small secondary copy). The text halo of liquid surfaces adds to this for real text.
  const floors = (panel: string, attrs: Record<string, string>): [number, number] => {
    if (panel === "liquid-clear") return [4.5, 2];
    if (panel === "liquid" || attrs["data-glass"] === "liquid") return [4.5, 3.5];
    return [4.8, 4.8];
  };
  for (const theme of ["light", "dark"] as const) {
    for (const [panel, attrs] of panels) {
      const [inkFloor, ink2Floor] = floors(panel, attrs);
      const glassAttr = (attrs as Record<string, string>)["data-glass"];
      for (const [name, backdrop] of Object.entries(BACKDROPS)) {
        test(`${panel}${glassAttr ? " (data-glass)" : ""} in ${theme} over ${name}: text-ink ${inkFloor}:1, text-ink-2 ${ink2Floor}:1`, async () => {
          document.documentElement.dataset.theme = theme;
          const [ink, ink2] = await worstContrast(
            panel,
            backdrop,
            ["text-ink", "text-ink-2"],
            attrs,
          );
          console.info(
            `contrast ${panel}/${theme}/${name}: ink ${ink?.toFixed(2)} ink-2 ${ink2?.toFixed(2)}`,
          );
          expect(ink, `${panel}/${theme}/${name} text-ink`).toBeGreaterThanOrEqual(inkFloor);
          expect(ink2, `${panel}/${theme}/${name} text-ink-2`).toBeGreaterThanOrEqual(ink2Floor);
        });
      }
    }
  }
});

const OFF = [
  { name: "prefers-reduced-transparency", value: "reduce" },
  { name: "prefers-reduced-motion", value: "reduce" },
  { name: "prefers-contrast", value: "more" },
  { name: "forced-colors", value: "active" },
];

describe("refraction is opt-in", () => {
  test("applies a displacement filter in Chromium and cleans up", async () => {
    const h = await mount(glassBox("glass"));
    const box = h.querySelector("[data-testid=box]") as HTMLElement;
    expect(box.dataset.glassRefraction).toBeUndefined();
    const cleanup = applyGlassRefraction(box);
    expect(box.dataset.glassRefraction).toBe("on");
    expect(styleOf(box).backdropFilter).toContain("url(");
    // The blur moves into the filter (soft middle, sharp rim); saturation stays in CSS.
    expect(styleOf(box).backdropFilter).toContain("saturate(1.8)");
    expect(styleOf(box).backdropFilter).not.toContain("blur(");
    expect(
      document
        .querySelector("#ui-glass-refraction-defs feGaussianBlur")
        ?.getAttribute("stdDeviation"),
    ).toBe("20");
    cleanup();
    expect(box.dataset.glassRefraction).toBeUndefined();
    expect(styleOf(box).backdropFilter).not.toContain("url(");
  });

  test("does nothing when the user prefers less transparency or motion", async () => {
    const h = await mount(glassBox("glass"));
    const box = h.querySelector("[data-testid=box]") as HTMLElement;
    for (const feature of OFF) {
      await emulate([feature]);
      applyGlassRefraction(box);
      expect(box.dataset.glassRefraction, feature.name).toBeUndefined();
    }
  });

  test("applying twice is idempotent: one filter, one url(), any cleanup stops it", async () => {
    const h = await mount(glassBox("glass"));
    const box = h.querySelector("[data-testid=box]") as HTMLElement;
    const first = applyGlassRefraction(box);
    const second = applyGlassRefraction(box);
    expect(document.querySelectorAll("#ui-glass-refraction-defs filter")).toHaveLength(1);
    expect(styleOf(box).backdropFilter.match(/url\(/g)).toHaveLength(1);
    first();
    expect(box.dataset.glassRefraction).toBeUndefined();
    expect(styleOf(box).backdropFilter).not.toContain("url(");
    second();
    expect(document.getElementById("ui-glass-refraction-defs")).toBeNull();
  });

  test("repeated apply and cleanup leaves no filters and no host behind", async () => {
    const h = await mount(glassBox("glass"));
    const box = h.querySelector("[data-testid=box]") as HTMLElement;
    for (let i = 0; i < 50; i++) applyGlassRefraction(box)();
    expect(document.getElementById("ui-glass-refraction-defs")).toBeNull();
    expect(box.style.backdropFilter).toBe("");
  });

  test("follows preference changes after it was applied, and comes back when cleared", async () => {
    const h = await mount(glassBox("glass"));
    const box = h.querySelector("[data-testid=box]") as HTMLElement;
    const stop = applyGlassRefraction(box);
    expect(box.dataset.glassRefraction).toBe("on");
    for (const feature of OFF) {
      await emulate([feature]);
      await vi.waitFor(() =>
        expect(box.dataset.glassRefraction, `${feature.name} removes it`).toBeUndefined(),
      );
      expect(styleOf(box).backdropFilter, feature.name).not.toContain("url(");
      expect(document.getElementById("ui-glass-refraction-defs"), feature.name).toBeNull();
      await emulate([]);
      await vi.waitFor(() =>
        expect(box.dataset.glassRefraction, `${feature.name} cleared`).toBe("on"),
      );
    }
    stop();
  });

  test("reads the blur from the stylesheet again when the preset changes", async () => {
    const h = await mount(glassBox("glass"));
    const box = h.querySelector("[data-testid=box]") as HTMLElement;
    const stop = applyGlassRefraction(box);
    const radius = () =>
      document
        .querySelector("#ui-glass-refraction-defs feGaussianBlur")
        ?.getAttribute("stdDeviation");
    expect(radius()).toBe("20");
    document.documentElement.dataset.style = "glass";
    await vi.waitFor(() => expect(radius()).toBe("24"));
    expect(styleOf(box).backdropFilter.match(/url\(/g)).toHaveLength(1);
    stop();
  });

  test("an element removed without cleanup does not leak its filter", async () => {
    const box = document.createElement("div");
    box.className = "glass";
    box.style.cssText = "position:absolute;width:200px;height:100px";
    document.body.appendChild(box);
    applyGlassRefraction(box);
    expect(document.querySelectorAll("#ui-glass-refraction-defs filter")).toHaveLength(1);
    box.remove();
    await new Promise((r) => setTimeout(r, 100));
    expect(document.getElementById("ui-glass-refraction-defs")).toBeNull();
  });
});

describe("liquid glass is a variant next to the frosted material", () => {
  const frosted = (el: Element) => styleOf(el).backdropFilter;
  const box = (h: HTMLElement) => h.querySelector("[data-testid=box]") as HTMLElement;

  test("glass and glass-clear keep their frosted rendering without a switch", async () => {
    const regular = await mount(glassBox("glass"));
    expect(frosted(box(regular))).toBe("blur(20px) saturate(1.8)");
    expect(styleOf(box(regular)).getPropertyValue("--glass-lens")).toBe("");
    await act(async () => root?.unmount());
    regular.remove();
    const clear = await mount(glassBox("glass-clear"));
    expect(frosted(box(clear))).toContain("blur(10px)");
  });

  test("liquid and liquid-clear carry the lens flag, a thin blur and a rim", async () => {
    const h = await mount(glassBox("liquid"));
    const s = styleOf(box(h));
    expect(s.backdropFilter).toBe("blur(2px) saturate(1.5)");
    expect(s.getPropertyValue("--glass-lens")).toBe("1");
    expect(s.boxShadow).toContain("inset");
    await act(async () => root?.unmount());
    h.remove();
    const clear = await mount(glassBox("liquid-clear"));
    expect(styleOf(box(clear)).backdropFilter).toContain("blur(0.6px)");
  });

  test("data-glass=liquid on an ancestor switches glass, glass-clear and the preset chrome", async () => {
    const h = await mount(
      <>
        {glassBox("glass")}
        <div data-testid="clear" className="glass-clear absolute inset-4" />
        <div data-testid="overlay" className="surface-overlay absolute inset-2" />
        <div data-testid="card" className="surface-card absolute inset-1" />
      </>,
      { "data-glass": "liquid", "data-style": "glass" },
    );
    expect(frosted(box(h))).toBe("blur(2px) saturate(1.5)");
    expect(frosted(h.querySelector("[data-testid=clear]") as Element)).toContain("blur(0.6px)");
    expect(frosted(h.querySelector("[data-testid=overlay]") as Element)).toBe(
      "blur(2px) saturate(1.5)",
    );
    expect(frosted(h.querySelector("[data-testid=card]") as Element)).toBe("none");
  });

  test("the chrome surfaces stay solid under data-glass=liquid when the preset is not glass", async () => {
    const h = await mount(
      <div data-testid="overlay" className="surface-overlay absolute inset-2" />,
      {
        "data-glass": "liquid",
      },
    );
    expect(frosted(h.querySelector("[data-testid=overlay]") as Element)).toBe("none");
  });

  test("liquid obeys every accessibility fallback and drops the lens flag", async () => {
    const h = await mount(glassBox("liquid"));
    for (const feature of [
      { name: "prefers-reduced-transparency", value: "reduce" },
      { name: "prefers-contrast", value: "more" },
      { name: "forced-colors", value: "active" },
    ]) {
      await emulate([feature]);
      const s = styleOf(box(h));
      expect(s.backdropFilter, feature.name).toBe("none");
      expect(alpha(s.backgroundColor), feature.name).toBe(1);
    }
  });

  test("liquid inside glass drops its blur like any nested glass", async () => {
    const h = await mount(
      glassBox("liquid", <div data-testid="inner" className="liquid absolute inset-4" />),
    );
    const inner = styleOf(h.querySelector("[data-testid=inner]") as Element);
    expect(inner.backdropFilter).toBe("none");
    expect(inner.getPropertyValue("--glass-lens")).toBe("0");
  });

  test("an interactive liquid surface flexes on press and not under reduced motion", async () => {
    const h = await mount(
      <button type="button" data-testid="btn" className="liquid absolute inset-8 rounded-full" />,
    );
    const btn = h.querySelector("[data-testid=btn]") as HTMLElement;
    expect(styleOf(btn).transitionProperty).toContain("scale");
    await emulate([{ name: "prefers-reduced-motion", value: "reduce" }]);
    expect(styleOf(btn).transitionProperty).not.toContain("scale");
    // Blur is never part of a transition.
    expect(styleOf(btn).transitionProperty).not.toContain("backdrop");
  });

  test("a frosted button does not flex", async () => {
    const h = await mount(
      <button type="button" data-testid="btn" className="glass absolute inset-8 rounded-full" />,
    );
    expect(
      styleOf(h.querySelector("[data-testid=btn]") as Element).transitionProperty,
    ).not.toContain("scale");
  });
});

describe("<LiquidGlass /> lenses liquid surfaces, and only those", () => {
  withLiquidGlass();
  const filters = () => document.querySelectorAll("#ui-glass-refraction-defs filter").length;
  const settle = () => new Promise((r) => setTimeout(r, 120));

  test("a Card with material=liquid is lensed, a frosted or solid one never loads the engine", async () => {
    await mount(
      <>
        <Card data-testid="liquid" material="liquid" className="absolute top-2 left-2 h-24 w-40" />
        <Card data-testid="frosted" material="glass" className="absolute top-2 left-52 h-24 w-40" />
        <Card data-testid="solid" className="absolute top-32 left-2 h-24 w-40" />
      </>,
    );
    await vi.waitFor(() => expect(filters()).toBe(1));
    const get = (id: string) => document.querySelector(`[data-testid=${id}]`) as HTMLElement;
    expect(get("liquid").dataset.glassRefraction).toBe("on");
    expect(get("frosted").dataset.glassRefraction).toBeUndefined();
    expect(get("solid").dataset.glassRefraction).toBeUndefined();
  });

  test("data-glass=liquid lenses a frosted-class component too, and data-glass-lens=off opts out", async () => {
    await mount(
      <>
        <Card data-testid="a" material="glass" className="absolute top-2 left-2 h-24 w-40" />
        <Card
          data-testid="b"
          material="glass"
          data-glass-lens="off"
          className="absolute top-2 left-52 h-24 w-40"
        />
      </>,
      { "data-glass": "liquid" },
    );
    await vi.waitFor(() => expect(filters()).toBe(1));
    await settle();
    expect((document.querySelector("[data-testid=a]") as HTMLElement).dataset.glassRefraction).toBe(
      "on",
    );
    expect(
      (document.querySelector("[data-testid=b]") as HTMLElement).dataset.glassRefraction,
    ).toBeUndefined();
    // Still liquid, just not lensed.
    expect(styleOf(document.querySelector("[data-testid=b]") as Element).backdropFilter).toBe(
      "blur(2px) saturate(1.5)",
    );
  });

  test("the lens is released when the component unmounts", async () => {
    await mount(<Card material="liquid" className="absolute top-2 left-2 h-24 w-40" />);
    await vi.waitFor(() => expect(filters()).toBe(1));
    await act(async () => root?.render(null));
    await vi.waitFor(() => expect(document.getElementById("ui-glass-refraction-defs")).toBeNull());
  });

  test("filters are bounded: more surfaces than the budget keep the plain liquid look", async () => {
    await mount(
      Array.from({ length: 12 }, (_, i) => (
        <Card
          // biome-ignore lint/suspicious/noArrayIndexKey: static fixture
          key={i}
          material="liquid"
          className="absolute h-10 w-24"
          style={{ left: (i % 4) * 100, top: Math.floor(i / 4) * 50 }}
        />
      )),
    );
    await settle();
    expect(filters()).toBe(8);
  });

  test("a surface above the area budget is not lensed", async () => {
    await mount(<Card material="liquid" className="absolute top-0 left-0 h-[900px] w-[900px]" />);
    await settle();
    expect(filters()).toBe(0);
  });

  describe("the lens follows the page", () => {
    const small = "absolute top-2 left-2 h-24 w-40";
    const passes = () =>
      document.querySelectorAll("#ui-glass-refraction-defs feDisplacementMap").length;
    const card = (material: "glass" | "liquid", extra: Record<string, string> = {}) => (
      <Card data-testid="c" material={material} className={small} {...extra} />
    );
    const el = () => document.querySelector("[data-testid=c]") as HTMLElement;

    test("liquid to glass on a mounted card releases the lens and restores the frosted look", async () => {
      await mount(card("liquid"));
      await vi.waitFor(() => expect(filters()).toBe(1));
      await act(async () => root?.render(card("glass")));
      await vi.waitFor(() => expect(filters()).toBe(0));
      expect(el().dataset.glassRefraction).toBeUndefined();
      expect(styleOf(el()).backdropFilter).not.toContain("url(");
      expect(el().style.getPropertyValue("--glass-veil")).toBe("");
      expect(alpha(styleOf(el()).getPropertyValue("--glass-veil"))).toBeGreaterThan(0.3);
    });

    test("removing the theme-level data-glass releases the lens", async () => {
      const box = await mount(card("glass"), { "data-glass": "liquid" });
      await vi.waitFor(() => expect(filters()).toBe(1));
      await act(async () => box.removeAttribute("data-glass"));
      await vi.waitFor(() => expect(filters()).toBe(0));
      expect(el().dataset.glassRefraction).toBeUndefined();
      expect(styleOf(el()).backdropFilter).not.toContain("url(");
    });

    test("glass to liquid on a mounted card gets the lens", async () => {
      await mount(card("glass"));
      await settle();
      expect(filters()).toBe(0);
      await act(async () => root?.render(card("liquid")));
      await vi.waitFor(() => expect(filters()).toBe(1));
      expect(el().dataset.glassRefraction).toBe("on");
    });

    test("switching data-glass=liquid on at runtime lenses a mounted frosted card", async () => {
      const box = await mount(card("glass"));
      await settle();
      expect(filters()).toBe(0);
      await act(async () => box.setAttribute("data-glass", "liquid"));
      await vi.waitFor(() => expect(filters()).toBe(1));
      await act(async () => box.removeAttribute("data-glass"));
      await vi.waitFor(() => expect(filters()).toBe(0));
    });

    test("an opt-out added or removed at runtime is honoured", async () => {
      const box = await mount(card("liquid"));
      await vi.waitFor(() => expect(filters()).toBe(1));
      await act(async () => box.setAttribute("data-glass-lens", "off"));
      await vi.waitFor(() => expect(filters()).toBe(0));
      await act(async () => box.removeAttribute("data-glass-lens"));
      await vi.waitFor(() => expect(filters()).toBe(1));
    });

    test("the area and dispersion budgets are checked on every resize, not only at install", async () => {
      const sized = (w: number, h: number) => (
        <Card
          data-testid="c"
          material="liquid"
          className="absolute top-0 left-0"
          style={{ width: w, height: h, "--glass-lens-dispersion": ".05" } as CSSProperties}
        />
      );
      await mount(sized(120, 48));
      await vi.waitFor(() => expect(passes()).toBe(3));
      // Grown past the dispersion budget (a dialog whose content arrives): one pass instead of three.
      await act(async () => root?.render(sized(400, 300)));
      await vi.waitFor(() => expect(passes()).toBe(1));
      // Grown past the area budget: no lens at all, the plain liquid look.
      await act(async () => root?.render(sized(900, 900)));
      await vi.waitFor(() => expect(filters()).toBe(0));
      expect(el().dataset.glassRefraction).toBeUndefined();
      // And back under: the lens returns.
      await act(async () => root?.render(sized(120, 48)));
      await vi.waitFor(() => expect(passes()).toBe(3));
    });

    test("a surface that found no free slot gets one when another is released", async () => {
      const grid = (skip: number) =>
        [..."abcdefghij"].map((id, i) =>
          i === skip ? null : (
            <Card
              key={id}
              data-testid={`c${i}`}
              material="liquid"
              className="absolute h-10 w-24"
              style={{ left: (i % 4) * 100, top: Math.floor(i / 4) * 50 }}
            />
          ),
        );
      await mount(grid(-1));
      await settle();
      expect(filters()).toBe(8);
      expect(
        document.querySelector("[data-testid=c8]")?.hasAttribute("data-glass-refraction"),
      ).toBe(false);
      await act(async () => root?.render(grid(0)));
      await vi.waitFor(() =>
        expect(
          document.querySelector("[data-testid=c8]")?.getAttribute("data-glass-refraction"),
        ).toBe("on"),
      );
      expect(filters()).toBe(8);
    });

    test("a changed ref identity is honoured and a ref cleanup runs on unmount", async () => {
      const log: string[] = [];
      const make = (name: string) => (node: HTMLDivElement | null) => {
        log.push(`${name}:${node ? "set" : "null"}`);
        return () => {
          log.push(`${name}:cleanup`);
        };
      };
      const a = make("a");
      const b = make("b");
      await mount(<Card material="liquid" ref={a} className={small} />);
      await vi.waitFor(() => expect(filters()).toBe(1));
      await act(async () => root?.render(<Card material="liquid" ref={b} className={small} />));
      expect(log).toContain("a:cleanup");
      expect(log).toContain("b:set");
      await vi.waitFor(() => expect(filters()).toBe(1));
      await act(async () => root?.render(null));
      expect(log).toContain("b:cleanup");
    });
  });

  test("the filter carries the directional rim light and the lens materialises to its capped strength", async () => {
    await mount(<Card material="liquid" className="absolute top-2 left-2 h-24 w-40" />);
    await vi.waitFor(() => expect(filters()).toBe(1));
    const defs = document.querySelector("#ui-glass-refraction-defs") as Element;
    expect(defs.querySelectorAll("feImage").length).toBe(2);
    expect(defs.querySelector('feColorMatrix[type="saturate"]')?.getAttribute("values")).toBe(
      "2.5",
    );
    await vi.waitFor(() => {
      const scale = Number(defs.querySelector("feDisplacementMap")?.getAttribute("scale"));
      // Full coverage: the offset is capped at 24px whatever the size.
      expect(scale).toBeGreaterThan(10);
      expect(scale).toBeLessThanOrEqual(2 * 24 * 1.01);
    });
  });

  test("a Dialog with material=liquid is lensed once open, with its blur and veil in the filter", async () => {
    await mount(
      <Dialog open>
        <DialogContent material="liquid" aria-describedby={undefined}>
          <DialogTitle>Liquid</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    await vi.waitFor(() => expect(filters()).toBe(1));
    const dlg = document.querySelector("[role=dialog]") as HTMLElement;
    expect(dlg.dataset.glassRefraction).toBe("on");
    expect(dlg.style.getPropertyValue("--glass-veil")).toBe("transparent");
    expect(document.querySelector("#ui-glass-refraction-defs feFlood")).not.toBeNull();
  });

  // With the lens the veil is adaptive: only as strong as the backdrop needs, so the body stays
  // clear. Over a smooth photo-like backdrop it still holds text-ink at 4.5:1 and text-ink-2 at
  // 2:1 on every pixel; over hard stripes (a backdrop no text should sit on) the worst pixel keeps
  // 2:1 and the text halo carries the glyphs. Both are measured on the backdrop, halo not counted.
  const SMOOTH =
    "radial-gradient(circle at 20% 30%, #ff3d71 0 70px, transparent 71px), radial-gradient(circle at 75% 70%, #00c2ff 0 90px, transparent 91px), linear-gradient(135deg, #ff9a3c, #1b2cc1 60%, #0b8f6b)";
  for (const [name, backdrop, floors] of [
    ["smooth photo", SMOOTH, [4.5, 2]],
    ["hard stripes", STRIPES, [2, 1]],
  ] as const) {
    test(`the lens contrast over ${name}: text-ink ${floors[0]}:1, text-ink-2 ${floors[1]}:1 with the lens on`, async () => {
      document.documentElement.dataset.theme = "light";
      host = document.createElement("div");
      host.style.cssText = `position:relative;width:600px;height:300px;background:${backdrop}`;
      document.body.appendChild(host);
      root = createRoot(host);
      await act(async () => {
        root?.render(
          <Card
            data-testid="box"
            material="liquid"
            className="absolute rounded-dialog"
            style={{ left: 60, top: 40, width: 480, height: 220 }}
          />,
        );
      });
      await vi.waitFor(() => expect(filters()).toBe(1));
      await settle();
      const el = host.querySelector("[data-testid=box]") as Element;
      const samples = await pixels(el);
      for (const [i, cls] of ["text-ink", "text-ink-2"].entries()) {
        const probe = document.createElement("span");
        probe.className = cls;
        el.appendChild(probe);
        const ink = lum(channels(styleOf(probe).color));
        probe.remove();
        const worst = Math.min(...samples.map((p) => contrast(ink, lum(p))));
        console.info(`lens contrast ${name} ${cls}: ${worst.toFixed(2)}`);
        expect(worst, cls).toBeGreaterThanOrEqual(floors[i] as number);
      }
    });
  }

  test("dispersion (three displacement passes) is off by default, and when asked for applies to small surfaces only", async () => {
    await mount(
      <>
        <Card
          material="liquid"
          className="absolute top-2 left-2 h-16 w-40"
          style={{ "--glass-lens-dispersion": ".05" } as CSSProperties}
        />
        <Card
          material="liquid"
          className="absolute top-24 left-2 h-[320px] w-[480px]"
          style={{ "--glass-lens-dispersion": ".05" } as CSSProperties}
        />
      </>,
    );
    await vi.waitFor(() => expect(filters()).toBe(2));
    const passes = [...document.querySelectorAll("#ui-glass-refraction-defs filter")].map(
      (f) => f.querySelectorAll("feDisplacementMap").length,
    );
    expect(passes.sort()).toEqual([1, 3]);
  });
});

describe("liquid options (liquidStyle, variables and presets)", () => {
  withLiquidGlass();
  const filters = () => document.querySelectorAll("#ui-glass-refraction-defs filter").length;
  const defs = () => document.querySelector("#ui-glass-refraction-defs") as Element;
  const scale = () => Number(defs().querySelector("feDisplacementMap")?.getAttribute("scale"));
  const settle = () => new Promise((r) => setTimeout(r, 400));
  const card = (spec: Spec, extra = "") => (
    <Card
      data-testid="box"
      {...surfaceProps(spec)}
      className={`absolute top-2 left-2 h-24 w-48 ${extra}`}
    />
  );

  test("refraction scales the displacement and follows a live change without stacking filters", async () => {
    await mount(card("liquid"));
    await vi.waitFor(() => expect(filters()).toBe(1));
    await settle();
    const full = scale();
    await act(async () => root?.render(card({ type: "liquid", refraction: 0.5 })));
    await vi.waitFor(() => expect(scale()).toBeCloseTo(full / 2, 0));
    expect(filters()).toBe(1);
    await act(async () => root?.render(card({ type: "liquid", refraction: 0 })));
    await vi.waitFor(() => expect(scale()).toBe(0));
  });

  test("bevelWidth caps the offset of a whole-surface lens", async () => {
    await mount(
      <Card
        data-testid="box"
        {...surfaceProps({ type: "liquid", bevelWidth: 6 })}
        className="absolute top-2 left-2 h-[300px] w-[400px]"
      />,
    );
    await vi.waitFor(() => expect(filters()).toBe(1));
    await settle();
    expect(scale()).toBeLessThanOrEqual(2 * 6 * 1.01);
    expect(scale()).toBeGreaterThan(8);
  });

  test("the profile changes the map; frost and saturation reach the filter and the backdrop", async () => {
    await mount(card({ type: "liquid", profile: "rim", frost: 6, saturation: 2 }));
    await vi.waitFor(() => expect(filters()).toBe(1));
    const maps = () => defs().querySelector("feImage")?.getAttribute("href");
    const rim = maps();
    expect(defs().querySelector("feGaussianBlur")?.getAttribute("stdDeviation")).toBe("6");
    const box = document.querySelector("[data-testid=box]") as HTMLElement;
    expect(styleOf(box).getPropertyValue("--liquid-profile")).toBe("rim");
    await act(async () => root?.render(card({ type: "liquid", profile: "dome", frost: 6 })));
    await vi.waitFor(() => expect(maps()).not.toBe(rim));
    expect(filters()).toBe(1);
  });

  test("specular intensity 0 drops the rim light layers; opacity 0 drops the adaptive veil", async () => {
    await mount(card({ type: "liquid", specular: { intensity: 0 } }));
    await vi.waitFor(() => expect(filters()).toBe(1));
    expect(defs().querySelectorAll("feImage").length).toBe(1);
    await act(async () => root?.render(card({ type: "liquid", specular: { angle: 30 } })));
    await vi.waitFor(() => expect(defs().querySelectorAll("feImage").length).toBe(2));
  });

  test("the surface is thicker the bigger it is: the shadow depth variable grows with the size", async () => {
    await mount(
      <>
        <Card data-testid="small" material="liquid" className="absolute top-2 left-2 h-12 w-24" />
        <Card
          data-testid="large"
          material="liquid"
          className="absolute top-16 left-2 h-[320px] w-[380px]"
        />
      </>,
    );
    await vi.waitFor(() => expect(filters()).toBe(2));
    const size = (id: string) =>
      Number(
        (document.querySelector(`[data-testid=${id}]`) as HTMLElement).style.getPropertyValue(
          "--liquid-size",
        ),
      );
    expect(size("large")).toBeGreaterThan(size("small"));
    expect(size("small")).toBeGreaterThanOrEqual(0.7);
    expect(size("large")).toBeLessThanOrEqual(1.5);
  });

  test("data-glass presets switch the look and set the options", async () => {
    await mount(card(undefined, "glass"), { "data-glass": "liquid-thick" });
    await vi.waitFor(() => expect(filters()).toBe(1));
    const box = document.querySelector("[data-testid=box]") as HTMLElement;
    expect(styleOf(box).getPropertyValue("--liquid-bevel").trim()).toBe("32px");
    expect(defs().querySelector("feGaussianBlur")?.getAttribute("stdDeviation")).toBe("3");
  });

  test("the crystal lens filters a layer larger than the surface, clipped to it, and puts the surface back", async () => {
    await mount(card({ type: "liquid", preset: "crystal" }, "rounded-full"));
    await vi.waitFor(() => expect(filters()).toBe(1));
    const box = document.querySelector("[data-testid=box]") as HTMLElement;
    const layer = box.querySelector("[data-glass-lens-layer]") as HTMLElement;
    expect(layer).toBeTruthy();
    // The surface carries no backdrop filter of its own; the layer does, and it is bigger.
    expect(styleOf(box).backdropFilter).toBe("none");
    expect(styleOf(layer).backdropFilter).toContain("url(");
    expect(layer.offsetWidth).toBeGreaterThan(box.offsetWidth + 40);
    expect(layer.style.clipPath).toContain("inset(");
    // Clear: no veil, no tint, no frost node.
    expect(styleOf(box).backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(
      [...defs().querySelectorAll("feGaussianBlur")].map((n) => n.getAttribute("stdDeviation")),
    ).toEqual(["0.7"]);
    // Chromatic aberration: three displacement passes.
    expect(defs().querySelectorAll("feDisplacementMap").length).toBe(3);
    const original = box.getAttribute("style");
    await act(async () => root?.render(card({ type: "liquid", preset: "regular" })));
    await vi.waitFor(() => expect(box.querySelector("[data-glass-lens-layer]")).toBeNull());
    expect(original).toContain("--liquid-profile");
    expect(box.style.isolation).toBe("");
    expect(box.style.overflow).toBe("");
  });

  test("tint, grain and opacity render on the surface", async () => {
    await mount(
      card({ type: "liquid", tint: { color: "red", amount: 1 }, grain: 0.5, opacity: 0.5 }),
    );
    const box = document.querySelector("[data-testid=box]") as HTMLElement;
    const image = styleOf(box).backgroundImage;
    expect(image).toContain("data:image/svg+xml");
    // Fully opaque red tint, and the veil at half strength (the theme veil is 0.6).
    expect(image).toContain("color(srgb 1 0 0)");
    expect(image).toContain("color(srgb 1 1 1 / 0.3)");
  });
});

describe("liquid motion", () => {
  withLiquidGlass();
  const filters = () => document.querySelectorAll("#ui-glass-refraction-defs filter").length;
  const scale = () =>
    Number(
      document.querySelector("#ui-glass-refraction-defs feDisplacementMap")?.getAttribute("scale"),
    );
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const surface = (
    spec: Spec,
    { style, ...extra }: Omit<ComponentProps<typeof Card>, "material"> = {},
  ) => {
    const props = surfaceProps(spec);
    return (
      <Card
        data-testid="box"
        data-glass-interactive=""
        material={props.material}
        style={{ ...props.style, ...style }}
        className="absolute top-8 left-8 h-24 w-48"
        {...extra}
      />
    );
  };
  const box = () => document.querySelector("[data-testid=box]") as HTMLElement;
  const fire = (type: string, x: number, y: number, target: Element = box()) =>
    target.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        clientX: x,
        clientY: y,
        pointerId: 7,
        pointerType: "mouse",
        button: 0,
      }),
    );
  const at = () => {
    const r = box().getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };

  test("the lens materialises by spring, then a press deepens it and swells the surface", async () => {
    // The scale the filter has the first time it is seen: the lens is not at full strength yet.
    const seen: number[] = [];
    const watch = new MutationObserver((records) => {
      for (const r of records) {
        const v = Number((r.target as Element).getAttribute("scale"));
        if (r.target instanceof SVGFEDisplacementMapElement) seen.push(v);
      }
    });
    watch.observe(document.documentElement, {
      subtree: true,
      attributes: true,
      attributeFilter: ["scale"],
    });
    await mount(surface("liquid"));
    await vi.waitFor(() => expect(filters()).toBe(1));
    await wait(900);
    watch.disconnect();
    const rest = scale();
    expect(seen[0]).toBeLessThan(rest * 0.6);
    expect(rest).toBeGreaterThan(10);
    const p = at();
    await act(async () => fire("pointerdown", p.x, p.y));
    await wait(500);
    expect(scale()).toBeGreaterThan(rest * 1.25);
    expect(scale()).toBeLessThanOrEqual(rest * 1.36);
    expect(Number.parseFloat(box().style.scale)).toBeGreaterThan(1);
    expect(Number.parseFloat(box().style.scale)).toBeLessThan(1.13);
    expect(box().style.transform).toBe("");
    expect(Number(box().style.getPropertyValue("--liquid-glow"))).toBeCloseTo(1, 1);
    await act(async () => fire("pointerup", p.x, p.y));
    await wait(900);
    expect(scale()).toBeCloseTo(rest, 0);
    // At rest the surface is given back: no `translate` or `scale` left behind.
    expect(box().style.scale).toBe("");
    expect(box().style.translate).toBe("");
  });

  test("a press moves the touch glow and the light with the pointer", async () => {
    await mount(surface("liquid"));
    await vi.waitFor(() => expect(filters()).toBe(1));
    const r = box().getBoundingClientRect();
    await act(async () => fire("pointerenter", r.left + 10, r.top + 10));
    await act(async () => fire("pointerdown", r.left + 10, r.top + 10));
    await wait(300);
    expect(box().style.getPropertyValue("--liquid-glow-x")).toBe("10.0px");
    expect(box().style.getPropertyValue("--liquid-glow-y")).toBe("10.0px");
    // The pointer is at the upper left: the lit wall is the upper left one (offset towards +x +y).
    expect(box().style.getPropertyValue("--liquid-rim-auto")).toMatch(/^inset [\d.]+px [\d.]+px/);
    await act(async () => fire("pointerup", r.left + 10, r.top + 10));
  });

  test("drag pulls the surface within a rubber band, squashes it, and settles back with its click swallowed", async () => {
    const clicks = vi.fn();
    await mount(surface({ type: "liquid", interactive: "drag" }, { onClick: clicks }));
    await vi.waitFor(() => expect(filters()).toBe(1));
    await wait(700);
    const p = at();
    await act(async () => fire("pointerdown", p.x, p.y));
    await act(async () => fire("pointermove", p.x + 400, p.y));
    await wait(120);
    const pulled = () => Number.parseFloat(getComputedStyle(box()).translate) || 0;
    expect(pulled()).toBeGreaterThan(5);
    await wait(500);
    const held = pulled();
    expect(held).toBeGreaterThan(30);
    expect(held).toBeLessThanOrEqual(48);
    // The browser sends the click right after the pointer-up, in the same task.
    await act(async () => {
      fire("pointerup", p.x + 400, p.y);
      box().click();
    });
    expect(clicks).not.toHaveBeenCalled();
    await wait(3500);
    expect(box().style.translate).toBe("");
    expect(box().style.scale).toBe("");
    // Not dragged: a plain click gets through.
    await act(async () => {
      box().click();
    });
    expect(clicks).toHaveBeenCalledTimes(1);
  });

  /** Every pointer listener added to, and removed from, the surface while `run` executes. */
  const listening = async (run: () => Promise<void>) => {
    const added: Array<[string, EventListenerOrEventListenerObject]> = [];
    const removed: Array<[string, EventListenerOrEventListenerObject]> = [];
    const isBox = (target: EventTarget) =>
      (target as Element).getAttribute?.("data-testid") === "box";
    const add = EventTarget.prototype.addEventListener;
    const remove = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener = function (type, listener, ...rest) {
      if (isBox(this) && listener && /^(pointer|lostpointer|click)/.test(type))
        added.push([type, listener]);
      return add.call(this, type, listener, ...(rest as [boolean?]));
    };
    EventTarget.prototype.removeEventListener = function (type, listener, ...rest) {
      if (isBox(this) && listener) removed.push([type, listener]);
      return remove.call(this, type, listener, ...(rest as [boolean?]));
    };
    try {
      await run();
    } finally {
      EventTarget.prototype.addEventListener = add;
      EventTarget.prototype.removeEventListener = remove;
    }
    return { added, removed };
  };

  test("motion off keeps the lens at full strength, listens to nothing and moves nothing", async () => {
    const { added } = await listening(async () => {
      await mount(surface({ type: "liquid", motion: false }));
      await vi.waitFor(() => expect(filters()).toBe(1));
      await wait(100);
    });
    expect(added).toEqual([]);
    const rest = scale();
    expect(rest).toBeGreaterThan(10);
    const p = at();
    await act(async () => fire("pointerdown", p.x, p.y));
    await wait(400);
    expect(box().style.scale).toBe("");
    expect(box().style.translate).toBe("");
    expect(box().style.getPropertyValue("--liquid-glow")).toBe("");
    expect(scale()).toBe(rest);
    await act(async () => fire("pointerup", p.x, p.y));
  });

  test("interactive none does not react to the pointer", async () => {
    await mount(surface({ type: "liquid", interactive: "none" }));
    await vi.waitFor(() => expect(filters()).toBe(1));
    await wait(700);
    const rest = scale();
    const p = at();
    await act(async () => fire("pointerdown", p.x, p.y));
    await wait(300);
    expect(scale()).toBeCloseTo(rest, 0);
    expect(box().style.scale).toBe("");
    expect(box().style.getPropertyValue("--liquid-glow")).toBe("");
    await act(async () => fire("pointerup", p.x, p.y));
  });

  test("reduced motion removes the lens and the motion with it", async () => {
    await emulate([{ name: "prefers-reduced-motion", value: "reduce" }]);
    await mount(surface({ type: "liquid", interactive: "drag" }));
    await wait(200);
    expect(filters()).toBe(0);
    const p = at();
    await act(async () => fire("pointerdown", p.x, p.y));
    await act(async () => fire("pointermove", p.x + 100, p.y));
    await wait(200);
    expect(box().style.translate).toBe("");
    expect(box().style.scale).toBe("");
    // The motion engine also refuses on its own.
    const { startLiquidMotion } = await import("./liquid-motion.js");
    expect(startLiquidMotion(box(), { onLevel() {} }, { materialize: true })).toBeUndefined();
  });

  test("the motion is released with the lens: its listeners are removed and nothing is left behind", async () => {
    let el: HTMLElement | undefined;
    const { added, removed } = await listening(async () => {
      await mount(
        surface({ type: "liquid", interactive: "drag" }, { style: { touchAction: "pan-y" } }),
      );
      await vi.waitFor(() => expect(filters()).toBe(1));
      el = box();
      const p = at();
      await act(async () => fire("pointerdown", p.x, p.y));
      await act(async () => fire("pointermove", p.x + 30, p.y));
      await wait(100);
      expect(el.style.touchAction).toBe("none");
      expect(el.style.translate).not.toBe("");
      await act(async () => root?.unmount());
      root = undefined;
      // <LiquidGlass /> releases a removed surface on the next frame.
      await vi.waitFor(() => expect(filters()).toBe(0));
    });
    // Pointer events and the click guard were really attached, and every one was removed again.
    expect(added.map(([type]) => type)).toEqual(
      expect.arrayContaining(["pointerdown", "pointermove", "pointerup", "click"]),
    );
    for (const [type, listener] of added)
      expect(removed.some(([t, l]) => t === type && l === listener)).toBe(true);
    expect(el?.style.translate).toBe("");
    expect(el?.style.scale).toBe("");
    expect(el?.style.touchAction).toBe("pan-y");
    expect(el?.style.getPropertyValue("--liquid-glow")).toBe("");
    expect(el?.style.getPropertyValue("--liquid-rim-auto")).toBe("");
    expect(filters()).toBe(0);
  });

  const drag = async (target: Element, dx: number) => {
    const p = at();
    await act(async () => fire("pointerdown", p.x, p.y, target));
    await act(async () => fire("pointermove", p.x + dx, p.y, target));
  };

  test("a press on a button inside a draggable surface is the button's: no capture, no drag, its click lands", async () => {
    const inner = vi.fn();
    await mount(
      surface(
        { type: "liquid", interactive: "drag" },
        {
          children: (
            <button type="button" data-testid="inner" onClick={inner}>
              Go
            </button>
          ),
        },
      ),
    );
    await vi.waitFor(() => expect(filters()).toBe(1));
    await wait(700);
    const capture = vi.spyOn(box(), "setPointerCapture");
    const button = document.querySelector("[data-testid=inner]") as HTMLElement;
    await drag(button, 80);
    await wait(300);
    expect(capture).not.toHaveBeenCalled();
    expect(Number.parseFloat(getComputedStyle(box()).translate) || 0).toBe(0);
    await act(async () => {
      fire("pointerup", 0, 0, button);
      button.click();
    });
    expect(inner).toHaveBeenCalledTimes(1);
  });

  test("the pointer is captured only once the drag passes the slop", async () => {
    await mount(surface({ type: "liquid", interactive: "drag" }));
    await vi.waitFor(() => expect(filters()).toBe(1));
    await wait(700);
    const capture = vi.spyOn(box(), "setPointerCapture");
    const p = at();
    await act(async () => fire("pointerdown", p.x, p.y));
    expect(capture).not.toHaveBeenCalled();
    await act(async () => fire("pointermove", p.x + 3, p.y));
    expect(capture).not.toHaveBeenCalled();
    await act(async () => fire("pointermove", p.x + 20, p.y));
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith(7);
    await act(async () => fire("pointerup", p.x + 20, p.y));
  });

  test("the click that ends a drag is swallowed even when it arrives late, and only that one", async () => {
    const clicks = vi.fn();
    await mount(surface({ type: "liquid", interactive: "drag" }, { onClick: clicks }));
    await vi.waitFor(() => expect(filters()).toBe(1));
    await wait(700);
    const p = at();
    // A touch click can arrive well after the pointer-up.
    await drag(box(), 200);
    await act(async () => fire("pointerup", p.x + 200, p.y));
    await wait(200);
    await act(async () => box().click());
    expect(clicks).not.toHaveBeenCalled();
    // The next click is an ordinary one.
    await act(async () => box().click());
    expect(clicks).toHaveBeenCalledTimes(1);
    // A click that never came is not kept for ever: past the window it passes.
    await drag(box(), 200);
    await act(async () => fire("pointerup", p.x + 200, p.y));
    await wait(450);
    await act(async () => box().click());
    expect(clicks).toHaveBeenCalledTimes(2);
    // And a new gesture drops a pending one.
    await drag(box(), 200);
    await act(async () => fire("pointerup", p.x + 200, p.y));
    await act(async () => fire("pointerdown", p.x, p.y));
    await act(async () => fire("pointerup", p.x, p.y));
    await act(async () => box().click());
    expect(clicks).toHaveBeenCalledTimes(3);
  });

  test("an author transform, scale and translate are kept while it moves and given back at rest", async () => {
    await mount(
      surface("liquid", {
        style: { transform: "rotate(7deg)", scale: "1.1", translate: "3px 4px" },
      }),
    );
    await vi.waitFor(() => expect(filters()).toBe(1));
    await wait(700);
    // Not pinned while idle (the old engine wrote `scale: 1` for the life of the lens).
    expect(box().style.scale).toBe("1.1");
    const p = at();
    await act(async () => fire("pointerdown", p.x, p.y));
    await wait(400);
    expect(box().style.transform).toBe("rotate(7deg)");
    const [sx] = box().style.scale.split(" ").map(Number);
    expect(sx).toBeGreaterThan(1.1);
    expect(sx).toBeLessThan(1.1 * 1.13);
    expect(getComputedStyle(box()).translate).toBe("3px 4px");
    await act(async () => fire("pointerup", p.x, p.y));
    await wait(1200);
    expect(box().style.transform).toBe("rotate(7deg)");
    expect(box().style.scale).toBe("1.1");
    expect(box().style.translate).toBe("3px 4px");
  });

  test("a press costs no style reads per frame", async () => {
    await mount(surface("liquid"));
    await vi.waitFor(() => expect(filters()).toBe(1));
    await wait(900);
    const read = vi.spyOn(window, "getComputedStyle");
    const p = at();
    await act(async () => fire("pointerenter", p.x, p.y));
    await act(async () => fire("pointerdown", p.x, p.y));
    for (let i = 0; i < 8; i++) {
      await act(async () => fire("pointermove", p.x + i, p.y));
      await wait(60);
    }
    await act(async () => fire("pointerup", p.x, p.y));
    await wait(700);
    // About 70 frames ran; the old code read the style at least twice a frame.
    expect(read.mock.calls.length).toBeLessThan(12);
    read.mockRestore();
  });

  test("--liquid-motion and --liquid-interactive are live", async () => {
    await mount(surface("liquid"));
    await vi.waitFor(() => expect(filters()).toBe(1));
    await wait(700);
    box().style.setProperty("--liquid-motion", "off");
    await wait(300);
    const p = at();
    await act(async () => fire("pointerdown", p.x, p.y));
    await wait(300);
    expect(box().style.scale).toBe("");
    expect(box().style.getPropertyValue("--liquid-glow")).toBe("");
    await act(async () => fire("pointerup", p.x, p.y));
    box().style.removeProperty("--liquid-motion");
    box().style.setProperty("--liquid-interactive", "none");
    await wait(300);
    await act(async () => fire("pointerdown", p.x, p.y));
    await wait(300);
    expect(box().style.scale).toBe("");
    await act(async () => fire("pointerup", p.x, p.y));
    box().style.setProperty("--liquid-interactive", "press");
    await wait(300);
    await act(async () => fire("pointerdown", p.x, p.y));
    await wait(300);
    expect(box().style.scale).not.toBe("");
    await act(async () => fire("pointerup", p.x, p.y));
  });

  test("a surface moved to another parent follows the new ancestors", async () => {
    await mount(surface("liquid"));
    await vi.waitFor(() => expect(filters()).toBe(1));
    await wait(700);
    const el = box();
    const parent = el.parentElement as HTMLElement;
    const scope = document.createElement("div");
    parent.appendChild(scope);
    scope.appendChild(el);
    try {
      await wait(300);
      scope.style.setProperty("--liquid-motion", "off");
      await wait(300);
      const p = at();
      await act(async () => fire("pointerdown", p.x, p.y));
      await wait(300);
      expect(el.style.scale).toBe("");
      await act(async () => fire("pointerup", p.x, p.y));
    } finally {
      parent.appendChild(el);
      scope.remove();
    }
  });

  test("an overlay's pointer mode is its own: a page-wide --liquid-interactive does not reach it", async () => {
    document.documentElement.style.setProperty("--liquid-interactive", "drag");
    try {
      await mount(
        <Dialog open>
          <DialogContent material="liquid" aria-describedby={undefined}>
            <DialogTitle>Liquid dialog</DialogTitle>
          </DialogContent>
        </Dialog>,
      );
      await vi.waitFor(() => expect(filters()).toBe(1));
      await wait(700);
      const dialog = document.querySelector("[role=dialog]") as HTMLElement;
      const r = dialog.getBoundingClientRect();
      const x = r.left + 20;
      const y = r.top + 20;
      await act(async () => fire("pointerdown", x, y, dialog));
      await act(async () => fire("pointermove", x + 120, y, dialog));
      await wait(300);
      expect(dialog.style.translate).toBe("");
      expect(dialog.style.scale).toBe("");
      await act(async () => fire("pointerup", x + 120, y, dialog));
      // Its own declaration still counts.
      dialog.style.setProperty("--liquid-interactive", "press");
      await wait(300);
      await act(async () => fire("pointerdown", x, y, dialog));
      await wait(300);
      expect(dialog.style.scale).not.toBe("");
      await act(async () => fire("pointerup", x, y, dialog));
    } finally {
      document.documentElement.style.removeProperty("--liquid-interactive");
    }
  });

  test("the auto shadow follows the theme, in light and in dark", async () => {
    const shadow = async (theme: "light" | "dark") => {
      document.documentElement.dataset.theme = theme;
      await mount(surface("liquid"));
      await vi.waitFor(() => expect(filters()).toBe(1));
      const value = getComputedStyle(box()).getPropertyValue("--liquid-shadow-auto");
      await act(async () => root?.unmount());
      host?.remove();
      root = host = undefined;
      return value;
    };
    expect(await shadow("light")).toMatch(/calc\(10px \* [\d.]+\) calc\(30px \*/);
    expect(await shadow("dark")).toMatch(/calc\(12px \* [\d.]+\) calc\(34px \*/);
  });
});
