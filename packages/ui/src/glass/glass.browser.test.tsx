/// <reference types="@vitest/browser-playwright" />
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test } from "vitest";
import { cdp, page } from "vitest/browser";
import "../../test/glass-browser.css";
import { Card } from "../containers/card/card.js";
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
              {LEGACY.map(([cls, token]) => (
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
    ["surface-overlay", { "data-style": "glass" }],
    ["surface-nav", { "data-style": "glass" }],
  ] as const;
  for (const theme of ["light", "dark"] as const) {
    for (const [panel, attrs] of panels) {
      for (const [name, backdrop] of Object.entries(BACKDROPS)) {
        test(`${panel} in ${theme} over ${name}: text-ink and text-ink-2 keep 4.5:1`, async () => {
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
          expect(ink, `${panel}/${theme}/${name} text-ink`).toBeGreaterThanOrEqual(4.5);
          expect(ink2, `${panel}/${theme}/${name} text-ink-2`).toBeGreaterThanOrEqual(4.5);
        });
      }
    }
  }
});

describe("refraction is opt-in", () => {
  test("applies a displacement filter in Chromium and cleans up", async () => {
    const h = await mount(glassBox("glass"));
    const box = h.querySelector("[data-testid=box]") as HTMLElement;
    expect(box.dataset.glassRefraction).toBeUndefined();
    const cleanup = applyGlassRefraction(box);
    expect(box.dataset.glassRefraction).toBe("on");
    expect(styleOf(box).backdropFilter).toContain("url(");
    expect(styleOf(box).backdropFilter).toContain("blur(20px)");
    cleanup();
    expect(box.dataset.glassRefraction).toBeUndefined();
    expect(styleOf(box).backdropFilter).not.toContain("url(");
  });

  test("does nothing when the user prefers less transparency or motion", async () => {
    const h = await mount(glassBox("glass"));
    const box = h.querySelector("[data-testid=box]") as HTMLElement;
    for (const feature of [
      { name: "prefers-reduced-transparency", value: "reduce" },
      { name: "prefers-reduced-motion", value: "reduce" },
      { name: "prefers-contrast", value: "more" },
    ]) {
      await emulate([feature]);
      applyGlassRefraction(box);
      expect(box.dataset.glassRefraction, feature.name).toBeUndefined();
    }
  });
});
