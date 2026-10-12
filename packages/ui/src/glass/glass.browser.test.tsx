/// <reference types="@vitest/browser-playwright" />
import { act, type ReactNode } from "react";
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
import { applyGlassRefraction } from "./refraction.js";

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
  for (const theme of ["light", "dark"] as const) {
    for (const [panel, attrs] of panels) {
      for (const [name, backdrop] of Object.entries(BACKDROPS)) {
        test(`${panel} in ${theme} over ${name}: text-ink and text-ink-2 keep 4.8:1 (4.5 required, 0.3 margin)`, async () => {
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
          expect(ink, `${panel}/${theme}/${name} text-ink`).toBeGreaterThanOrEqual(4.8);
          expect(ink2, `${panel}/${theme}/${name} text-ink-2`).toBeGreaterThanOrEqual(4.8);
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
    expect(s.backdropFilter).toBe("blur(10px) saturate(2)");
    expect(s.getPropertyValue("--glass-lens")).toBe("1");
    expect(s.boxShadow).toContain("inset");
    await act(async () => root?.unmount());
    h.remove();
    const clear = await mount(glassBox("liquid-clear"));
    expect(styleOf(box(clear)).backdropFilter).toContain("blur(3px)");
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
    expect(frosted(box(h))).toBe("blur(10px) saturate(2)");
    expect(frosted(h.querySelector("[data-testid=clear]") as Element)).toContain("blur(3px)");
    expect(frosted(h.querySelector("[data-testid=overlay]") as Element)).toBe(
      "blur(10px) saturate(2)",
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

describe("components apply the lens by themselves, only for liquid surfaces", () => {
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
      "blur(10px) saturate(2)",
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

  test("the lens contrast: ink and ink-2 hold over stripes with the lens on", async () => {
    document.documentElement.dataset.theme = "light";
    host = document.createElement("div");
    host.style.cssText = `position:relative;width:600px;height:300px;background:${STRIPES}`;
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
    const el = host.querySelector("[data-testid=box]") as Element;
    const samples = await pixels(el);
    for (const cls of ["text-ink", "text-ink-2"]) {
      const probe = document.createElement("span");
      probe.className = cls;
      el.appendChild(probe);
      const ink = lum(channels(styleOf(probe).color));
      probe.remove();
      expect(Math.min(...samples.map((p) => contrast(ink, lum(p)))), cls).toBeGreaterThanOrEqual(
        4.8,
      );
    }
  });
});
