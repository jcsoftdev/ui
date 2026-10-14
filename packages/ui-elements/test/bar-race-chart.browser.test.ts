import axe from "axe-core";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { commands, userEvent } from "vitest/browser";
import type { UiBarRaceChart } from "../src/bar-race-chart/bar-race-chart.ts";
import { defineBarRaceChart } from "../src/bar-race-chart/bar-race-chart.ts";
import { defineChartTooltip } from "../src/chart-tooltip/chart-tooltip.ts";
import { ax, frame, mount, wait } from "./setup.ts";

beforeAll(() => {
  defineBarRaceChart();
  defineChartTooltip();
});

/** The real mouse rests on a corner, so a chart mounted under the last test's pointer is not hovered. */
beforeEach(async () => {
  await commands.reducedMotion("no-preference");
  const park = mount(
    '<i id="park" style="position:fixed;right:0;bottom:0;width:6px;height:6px"></i>',
  );
  await userEvent.hover(park.firstElementChild as Element);
});
afterEach(() => {
  document.body.innerHTML = "";
});

const ENTITIES = ["Kevin", "Renzo", "Abel", "Diego"].map((name) => ({
  id: name.toLowerCase(),
  name,
}));
// Frame 0: Kevin leads. Frame 1: Abel overtakes. Frame 2: Renzo leads.
const FRAMES = [
  { label: "Sem 1", values: [40, 30, 20, 10] },
  { label: "Sem 2", values: [45, 35, 60, 12] },
  { label: "Sem 3", values: [50, 90, 62, 14] },
];

const settle = async () => {
  await frame();
  await frame();
  await wait(30);
};
const race = async (attrs = "", width = 420) => {
  const host = mount(
    `<div style="width:${width}px"><ui-bar-race-chart label="Race" locale="en-US" height="240" topn="3" frame-duration="300" ${attrs}></ui-bar-race-chart></div>`,
  );
  const el = host.querySelector("ui-bar-race-chart") as UiBarRaceChart;
  el.entities = ENTITIES;
  el.frames = FRAMES;
  await settle();
  return el;
};
const marks = (el: Element) => [...el.querySelectorAll<SVGElement>("svg [role=img]")];
const names = (el: Element) => marks(el).map((m) => m.getAttribute("aria-label")?.split(":")[0]);
const drawing = (el: Element) => el.querySelector("[data-ui-part=drawing]") as HTMLElement;
const move = (el: Element, x: number, y: number, pointerType = "mouse", type = "pointermove") => {
  const box = (el.querySelector("svg") as SVGSVGElement).getBoundingClientRect();
  drawing(el).dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      clientX: box.left + x,
      clientY: box.top + y,
      pointerType,
      pointerId: 1,
      isPrimary: true,
    }),
  );
};
const row = (i: number) => 4 + ((240 - 8) / 3) * (i + 0.5);

describe("ui-bar-race-chart: still frames", () => {
  it("is a group named by the label, with one image per racing bar in rank order", async () => {
    const el = await race('autoplay="off"');
    expect(await ax("group", "Race")).toBeTruthy();
    expect(names(el)).toEqual(["Kevin", "Renzo", "Abel"]);
    el.frame = 1;
    await settle();
    expect(names(el)).toEqual(["Abel", "Kevin", "Renzo"]);
    expect(marks(el)[0]?.getAttribute("aria-label")).toBe("Abel: 60, #1");
    expect(el.querySelector("[data-ui-part=frame-label]")?.textContent).toBe("Sem 2");
    // The fourth bar is drawn for the fade, but it is not a mark.
    expect(el.querySelectorAll("[data-entity]")).toHaveLength(4);
    expect(el.querySelectorAll("[data-entity][aria-hidden]")).toHaveLength(1);
  });

  it("glides between frames: a fractional position puts a bar between two rows", async () => {
    const el = await race('autoplay="off"');
    el.position = 0.5;
    await settle();
    const y = (id: string) =>
      Number(
        el
          .querySelector(`[data-entity=${id}]`)
          ?.getAttribute("transform")
          ?.match(/,([\d.]+)\)/)?.[1],
      );
    const rest = (position: number) => {
      el.position = position;
      return settle().then(() => y("abel"));
    };
    const [a0, a1] = [await rest(0), await rest(1)];
    const mid = await rest(0.5);
    expect(mid).toBeGreaterThan(Math.min(a0, a1));
    expect(mid).toBeLessThan(Math.max(a0, a1));
  });

  it("shows the table of every frame to assistive tech and names the slider with the frame", async () => {
    const el = await race('autoplay="off"');
    await wait(400);
    expect(el.querySelectorAll("table th").length).toBeGreaterThan(3);
    const slider = el.querySelector("input[type=range]") as HTMLInputElement;
    expect(slider.getAttribute("aria-label")).toBe("Moment");
    expect(slider.getAttribute("aria-valuetext")).toBe("Sem 1");
    expect(slider.max).toBe("2");
  });
});

describe("ui-bar-race-chart: playback", () => {
  it("autoplays, loops, and settles deterministically on pause()", async () => {
    const el = await race();
    expect(el.playing).toBe(true);
    expect(el.dataset.playing).toBeDefined();
    const seen = new Set<string>();
    const stop = setInterval(() => seen.add(el.dataset.frame ?? ""), 20);
    await wait(1100);
    clearInterval(stop);
    expect(seen.size).toBeGreaterThan(1);
    el.pause();
    const at = el.position;
    await wait(150);
    expect(el.position).toBe(at);
    expect(el.dataset.playing).toBeUndefined();
    expect(el.dataset.frame).toBe(`${Math.round(at)}`);
  });

  it("animates with transient frames: no chart-data, the same snapshot object", async () => {
    const el = await race();
    const data = el as unknown as { chartSnapshot: unknown };
    const before = data.chartSnapshot;
    let events = 0;
    el.addEventListener("chart-data", () => events++);
    await wait(500);
    expect(el.position).toBeGreaterThan(0);
    expect(events).toBe(0);
    expect(data.chartSnapshot).toBe(before);
  });

  it("emits race-frame when the shown frame changes, and race-playing on toggles", async () => {
    const el = await race('autoplay="off"');
    const frames: number[] = [];
    const states: boolean[] = [];
    el.addEventListener("race-frame", (e) => frames.push((e as CustomEvent).detail.index));
    el.addEventListener("race-playing", (e) => states.push((e as CustomEvent).detail.playing));
    el.step();
    el.step();
    el.step();
    expect(frames).toEqual([1, 2]);
    el.play();
    expect(el.position).toBe(0);
    el.pause();
    expect(states).toEqual([true, false]);
  });

  it("stops at the end without a loop, and play restarts from the first frame", async () => {
    const el = await race('loop="off"');
    await wait(900);
    expect(el.position).toBe(2);
    expect(el.playing).toBe(false);
    el.toggle();
    expect(el.position).toBe(0);
    expect(el.playing).toBe(true);
  });

  it("holds still offscreen and in a hidden tab, then resumes", async () => {
    const el = await race();
    (el.parentElement as HTMLElement).style.marginTop = "4000px";
    await wait(250);
    const parked = el.position;
    await wait(250);
    expect(el.position).toBe(parked);
    expect(el.playing).toBe(true);
    (el.parentElement as HTMLElement).style.marginTop = "0";
    await wait(300);
    expect(el.position).not.toBe(parked);

    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    await frame();
    const hidden = el.position;
    await wait(200);
    expect(el.position).toBe(hidden);
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    await wait(200);
    expect(el.position).not.toBe(hidden);
  });

  it("cancels its animation frame when it leaves the page", async () => {
    const el = await race();
    await wait(100);
    const host = el.parentElement as HTMLElement;
    host.remove();
    const gone = el.position;
    await wait(200);
    expect(el.position).toBe(gone);
    document.body.append(host);
    await wait(200);
    expect(el.position).not.toBe(gone);
  });

  it("starts paused under reduced motion and steps from frame to frame", async () => {
    await commands.reducedMotion("reduce");
    const el = await race();
    expect(el.playing).toBe(false);
    el.position = 1.4;
    await settle();
    expect(names(el)).toEqual(["Abel", "Kevin", "Renzo"]);
    const bars = [...el.querySelectorAll("[data-entity] rect")].map((r) => r.getAttribute("width"));
    el.position = 1;
    await settle();
    expect(
      [...el.querySelectorAll("[data-entity] rect")].map((r) => r.getAttribute("width")),
    ).toEqual(bars);
  });
});

describe("ui-bar-race-chart: controls and keyboard", () => {
  it("toggles with the play button and scrubs with the slider, which pauses", async () => {
    const el = await race('autoplay="off"');
    const button = el.querySelector("button") as HTMLButtonElement;
    expect(button.getAttribute("aria-label")).toBe("Play");
    button.click();
    expect(el.playing).toBe(true);
    expect(button.getAttribute("aria-label")).toBe("Pause");
    const slider = el.querySelector("input[type=range]") as HTMLInputElement;
    slider.value = "1.5";
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    expect(el.playing).toBe(false);
    expect(el.position).toBe(1.5);
    await settle();
    expect(el.querySelector("[data-ui-part=caption]")?.textContent).toBe("Sem 3");
  });

  it("steps whole frames from the keyboard on the slider", async () => {
    const el = await race('autoplay="off"');
    (el.querySelector("input[type=range]") as HTMLElement).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(el.frame).toBe(1);
    await userEvent.keyboard("{End}");
    expect(el.frame).toBe(2);
    await userEvent.keyboard("{ArrowLeft}{Home}");
    expect(el.frame).toBe(0);
  });

  it("walks the ranks with the arrows, pauses on focus, and PageUp/PageDown step frames", async () => {
    const el = await race();
    expect(el.playing).toBe(true);
    await userEvent.tab();
    await wait(80);
    expect(document.activeElement?.getAttribute("role")).toBe("img");
    expect(el.playing).toBe(false);
    const at = el.frame;
    await userEvent.keyboard("{PageUp}");
    expect(el.frame).toBe(Math.min(2, at + 1));
    await settle();
    await userEvent.keyboard("{ArrowDown}");
    await settle();
    // Focus stays on the bar it was on (Kevin, now second), so ArrowDown goes to the third.
    expect(document.activeElement).toBe(marks(el)[2]);
    await userEvent.keyboard("{PageDown}");
    expect(el.frame).toBe(at);
  });

  it("uses the label attributes for the controls", async () => {
    const el = await race('autoplay="off" play-label="Reproducir" moment-label="Semana"');
    expect(el.querySelector("button")?.getAttribute("aria-label")).toBe("Reproducir");
    expect(el.querySelector("input")?.getAttribute("aria-label")).toBe("Semana");
  });
});

describe("ui-bar-race-chart: hover, touch, axe", () => {
  it("hovers one bar per row, in order, with no flicker", async () => {
    const el = await race('autoplay="off"');
    drawing(el).dispatchEvent(new PointerEvent("pointerenter", { pointerType: "mouse" }));
    await wait(80);
    const seen: Array<number | null> = [];
    el.addEventListener("chart-hover", (e) => seen.push((e as CustomEvent).detail?.index ?? null));
    for (const i of [0, 0, 1, 1, 2]) move(el, 200, row(i));
    expect(seen).toEqual([0, 1, 2]);
    const info = (el as unknown as { hover: { title: string; rows: Array<{ value: string }> } })
      .hover;
    expect(info.title).toBe("Abel");
    expect(info.rows[0]?.value).toBe("20");
  });

  it("pins a bar on a tap", async () => {
    const el = await race('autoplay="off"');
    const picked: unknown[] = [];
    el.addEventListener("chart-select", (e) => picked.push((e as CustomEvent).detail));
    move(el, 200, row(1), "touch", "pointerdown");
    move(el, 200, row(1), "touch", "pointerup");
    await wait(80);
    expect(picked).toEqual([{ index: 1, category: 1 }]);
    expect((el as unknown as { selected: number }).selected).toBe(1);
  });

  it("passes axe on a settled frame", async () => {
    const el = await race('autoplay="off"');
    el.pause();
    const result = await axe.run(el, {
      // Contrast needs the page theme; "region" is about the page, not the component.
      rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
    });
    expect(result.violations.map((v) => v.id)).toEqual([]);
  });

  it("shows the empty state without data", async () => {
    const host = mount(
      '<div style="width:300px"><ui-bar-race-chart label="Race"></ui-bar-race-chart></div>',
    );
    await settle();
    expect((host.querySelector("[data-ui-part=controls]") as HTMLElement).hidden).toBe(true);
  });
});
