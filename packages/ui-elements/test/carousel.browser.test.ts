import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { nearestIndex, stepIndex } from "../../ui/src/containers/carousel/model.ts";
import { defineCarousel, type UiCarousel } from "../src/carousel/carousel.ts";
import * as mine from "../src/internal/e11.ts";
import { ax, mount, wait } from "./setup.ts";

beforeAll(() => {
  defineCarousel();
});

afterEach(() => {
  document.body.innerHTML = "";
});

const slides = (n: number) =>
  Array.from({ length: n }, (_, i) => `<div style="height:60px">Slide ${i + 1}</div>`).join("");

// Offset from the origin: a pointer parked at 0,0 would count as hovering and pause autoplay.
const carousel = (attrs = "", n = 3, dir = "ltr") =>
  mount(
    `<div dir="${dir}" style="width:400px;margin:200px 0 0 200px"><ui-carousel label="Gallery" ${attrs}>${slides(n)}</ui-carousel></div>`,
  ).querySelector<UiCarousel>("ui-carousel")!;

const settle = async (el: UiCarousel, index: number) =>
  vi.waitFor(() => expect(el.index).toBe(index), { timeout: 3000 });

describe("carousel model (parity with the React kit)", () => {
  it("steps and picks the nearest slide like the React maths", () => {
    for (const loop of [false, true])
      for (const dir of [1, -1] as const)
        for (let count = 0; count <= 4; count += 1)
          for (let index = 0; index < Math.max(count, 1); index += 1)
            expect(mine.stepIndex(index, count, dir, loop)).toBe(
              stepIndex(index, count, dir, loop),
            );
    const offsets = [0, 400, 800, 1200];
    for (const at of [-20, 0, 190, 210, 899, 5000])
      expect(mine.nearestIndex(at, offsets)).toBe(nearestIndex(at, offsets));
  });
});

describe("ui-carousel", () => {
  it("follows the APG carousel pattern", async () => {
    const el = carousel();
    expect(el.getAttribute("role")).toBe("region");
    expect(el.getAttribute("aria-roledescription")).toBe("carousel");
    expect(await ax("region", "Gallery")).toBeTruthy();
    const group = el.querySelectorAll<HTMLElement>("[data-ui-slide]");
    expect(group).toHaveLength(3);
    expect(group[1]!.getAttribute("aria-roledescription")).toBe("slide");
    expect(group[1]!.getAttribute("aria-label")).toBe("2 of 3");
    expect(await ax("button", "Next slide")).toBeTruthy();
    expect(el.querySelector<HTMLButtonElement>("[data-ui-part=previous]")!.disabled).toBe(true);
    const dots = el.querySelectorAll("[data-ui-part=dot]");
    expect(dots[0]!.getAttribute("aria-current")).toBe("true");
    expect(dots[1]!.getAttribute("aria-label")).toBe("Go to slide 2");
    // the scrollable track is the one tab stop and is labelled
    const track = el.querySelector<HTMLElement>("[data-ui-part=track]")!;
    expect(track.tabIndex).toBe(0);
    expect(track.getAttribute("aria-live")).toBe("polite");
  });

  it("scrolls with the buttons, dots and keys and reports the visible slide", async () => {
    const el = carousel();
    const change = vi.fn();
    el.addEventListener("change", change);
    el.querySelector<HTMLButtonElement>("[data-ui-part=next]")!.click();
    await settle(el, 1);
    expect(change).toHaveBeenCalledWith(expect.objectContaining({ detail: { index: 1 } }));
    el.querySelectorAll<HTMLButtonElement>("[data-ui-part=dot]")[2]!.click();
    await settle(el, 2);
    expect(el.querySelector<HTMLButtonElement>("[data-ui-part=next]")!.disabled).toBe(true);
    el.querySelector<HTMLElement>("[data-ui-part=track]")!.focus();
    await userEvent.keyboard("{Home}");
    await settle(el, 0);
    await userEvent.keyboard("{End}");
    await settle(el, 2);
    await userEvent.keyboard("{ArrowLeft}");
    await settle(el, 1);
  });

  it("wraps with loop", async () => {
    const el = carousel("loop");
    const previous = el.querySelector<HTMLButtonElement>("[data-ui-part=previous]")!;
    expect(previous.disabled).toBe(false);
    previous.click();
    await settle(el, 2);
  });

  it("mirrors the keys and the scroll direction in right-to-left", async () => {
    const el = carousel("", 3, "rtl");
    el.querySelector<HTMLElement>("[data-ui-part=track]")!.focus();
    await userEvent.keyboard("{ArrowLeft}");
    await settle(el, 1);
    await userEvent.keyboard("{ArrowRight}");
    await settle(el, 0);
    el.querySelector<HTMLButtonElement>("[data-ui-part=next]")!.click();
    await settle(el, 1);
  });

  it("auto-rotates, pauses on focus, and stops with the pause button", async () => {
    const el = carousel('autoplay="150"');
    const changes = vi.fn();
    el.addEventListener("change", changes);
    const track = el.querySelector<HTMLElement>("[data-ui-part=track]")!;
    expect(track.getAttribute("aria-live")).toBe("off");
    const pause = el.querySelector<HTMLButtonElement>("[data-ui-part=pause]")!;
    expect(pause.getAttribute("aria-label")).toBe("Pause automatic slide show");
    expect(el.hasAttribute("data-playing")).toBe(true);
    await vi.waitFor(() => expect(changes).toHaveBeenCalled(), { timeout: 3000 });
    track.focus({ preventScroll: true });
    expect(el.hasAttribute("data-playing")).toBe(false);
    track.blur();
    expect(el.hasAttribute("data-playing")).toBe(true);
    pause.click();
    expect(el.hasAttribute("data-playing")).toBe(false);
    expect(pause.getAttribute("aria-pressed")).toBe("true");
    expect(pause.getAttribute("aria-label")).toBe("Start automatic slide show");
    // let any scroll in flight land, then nothing may move
    await wait(900);
    const settled = changes.mock.calls.length;
    await wait(500);
    expect(changes.mock.calls.length).toBe(settled);
  });

  it("shows several slides per view and can still reach the last ones", async () => {
    const host = mount(
      `<div style="width:700px;margin:200px 0 0 200px"><ui-carousel label="Wide">${slides(4)}</ui-carousel></div>`,
    );
    const el = host.querySelector<UiCarousel>("ui-carousel")!;
    const track = el.querySelector<HTMLElement>("[data-ui-part=track]")!;
    await vi.waitFor(() => expect(el.snapCount).toBe(3));
    expect(el.querySelectorAll("[data-ui-part=dot]")).toHaveLength(3);
    const first = el.querySelectorAll<HTMLElement>("[data-ui-slide]");
    expect(first[0]!.getBoundingClientRect().width).toBeLessThan(400);
    el.querySelector<HTMLElement>("[data-ui-part=track]")!.focus();
    await userEvent.keyboard("{End}");
    await settle(el, 2);
    await vi.waitFor(() => expect(Math.abs(track.scrollLeft)).toBeGreaterThan(700));
    expect(el.querySelector<HTMLButtonElement>("[data-ui-part=next]")!.disabled).toBe(true);
    // out-of-view slides are inert; the visible ones are not
    await vi.waitFor(() => expect(first[0]!.inert).toBe(true));
    expect(first[3]!.inert).toBe(false);
    expect(el.querySelector("[data-ui-part=status]")!.textContent).toBe("3 of 4");
    await userEvent.keyboard("{ArrowLeft}");
    await settle(el, 1);
  });

  it("puts the rotation control before the slides and stops at the last slide", async () => {
    const el = carousel('autoplay="120"', 2);
    expect(el.firstElementChild!.getAttribute("data-ui-part")).toBe("pause");
    await settle(el, 1);
    await wait(400);
    expect(el.hasAttribute("data-playing")).toBe(false);
    expect(el.index).toBe(1);
  });

  it("hides the rotation control when nothing rotates", () => {
    const el = carousel("", 3);
    expect(el.querySelector<HTMLElement>("[data-ui-part=pause]")!.hidden).toBe(true);
  });

  it("registers under a custom prefix", () => {
    expect(defineCarousel({ prefix: "acme" })).toBe("acme-carousel");
  });
});
