/// <reference types="@vitest/browser-playwright" />
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test } from "vitest";
import { cdp, page } from "vitest/browser";
import "../../../test/glass-browser.css";
import { BarChart } from "../bar-chart/bar-chart.js";
import { moveTo, tapAt } from "./pointer.test-utils.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let host: HTMLElement | undefined;

const barbers = ["Kevin", "Renzo", "Abel", "Diego", "Luis"];

/** A 390px wide chart card with a paragraph under it, to watch for layout shift. */
async function mount() {
  host = document.createElement("div");
  host.style.cssText = "width:390px";
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () =>
    root?.render(
      <>
        <BarChart
          title="Citas por barbero"
          categories={barbers}
          series={[{ id: "citas", name: "Citas", data: [42, 38, 51, 29, 35] }]}
          valueFormat="integer"
          legend={false}
          height={220}
          animate={false}
        />
        <p id="below" style={{ margin: 0 }}>
          Debajo
        </p>
      </>,
    ),
  );
  const slider = host.querySelector<HTMLElement>("[role='slider']") as HTMLElement;
  const below = host.querySelector<HTMLElement>("#below") as HTMLElement;
  const slot = host.querySelector<HTMLElement>("[data-chart-dock]") as HTMLElement;
  const box = slider.getBoundingClientRect();
  return {
    slider,
    below,
    slot,
    point: { x: box.left + box.width * 0.7, y: box.top + box.height * 0.5 },
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 120));

afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  root = host = undefined;
  await page.viewport(1280, 800);
  await cdp().send("Emulation.setTouchEmulationEnabled", { enabled: false });
});

describe("chart dock", () => {
  test("a narrow card with a mouse on a desktop viewport floats and reserves nothing", async () => {
    const { below, slot, point } = await mount();
    const top = below.getBoundingClientRect().top;
    await expect(getComputedStyle(slot).display).toBe("none");
    await moveTo(point);
    await settle();
    await expect(host?.querySelector("[data-chart-tooltip]:not([data-docked])")).not.toBeNull();
    await expect(host?.querySelector("[data-docked]")).toBeNull();
    await expect(below.getBoundingClientRect().top).toBe(top);
  });

  test("a phone-sized viewport reserves the panel and docks a tap without shifting", async () => {
    await page.viewport(390, 844);
    const { below, slot, point } = await mount();
    await expect(getComputedStyle(slot).display).toBe("block");
    await expect(slot.getBoundingClientRect().height).toBe(160);
    const top = below.getBoundingClientRect().top;
    await tapAt(point);
    await settle();
    const panel = host?.querySelector<HTMLElement>("[data-docked]") as HTMLElement;
    await expect(panel).not.toBeNull();
    await expect(slot.contains(panel)).toBe(true);
    await expect(getComputedStyle(panel).position).toBe("static");
    await expect(below.getBoundingClientRect().top).toBe(top);
  });

  test("a coarse pointer docks even on a wide viewport", async () => {
    await cdp().send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
    await expect(matchMedia("(pointer: coarse)").matches).toBe(true);
    const { below, slot, point } = await mount();
    await expect(getComputedStyle(slot).display).toBe("block");
    const top = below.getBoundingClientRect().top;
    await tapAt(point);
    await settle();
    await expect(slot.querySelector("[data-docked]")).not.toBeNull();
    await expect(below.getBoundingClientRect().top).toBe(top);
  });

  test("announces a pinned tap once, not a mouse hover", async () => {
    await page.viewport(390, 844);
    const { slider, slot, point } = await mount();
    const live = () => host?.querySelector<HTMLElement>("[role='status']")?.textContent ?? "";
    await moveTo(point);
    await new Promise((resolve) => setTimeout(resolve, 300));
    await expect(live()).toBe("");
    await tapAt(point);
    await new Promise((resolve) => setTimeout(resolve, 300));
    await expect(live()).toContain("Diego");
    await expect(slot.getAttribute("aria-hidden")).toBe("true");
    await expect(slider).toBeDefined();
  });
});
