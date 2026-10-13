import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { formatTrend, trendDirection, trendTone } from "../../ui/src/atoms/trend-chip/trend.ts";
import { defineAvatar, initials, type UiAvatar } from "../src/avatar/avatar.ts";
import { defineAvatarGroup } from "../src/avatar-group/avatar-group.ts";
import { defineChip } from "../src/chip/chip.ts";
import {
  trendDirection as elementDirection,
  formatTrend as elementFormatTrend,
  trendTone as elementTone,
} from "../src/internal/e1-trend.ts";
import { defineLed } from "../src/led/led.ts";
import { defineMeter } from "../src/meter/meter.ts";
import { defineProgress, type UiProgress } from "../src/progress/progress.ts";
import { defineStatusDot } from "../src/status-dot/status-dot.ts";
import { defineStatusPill, type UiStatusPill } from "../src/status-pill/status-pill.ts";
import { defineTrendChip } from "../src/trend-chip/trend-chip.ts";
import { ax, mount, wait } from "./setup.ts";

beforeAll(() => {
  defineAvatar();
  defineAvatarGroup();
  defineChip();
  defineLed();
  defineMeter();
  defineProgress();
  defineStatusDot();
  defineStatusPill();
  defineTrendChip();
});

afterEach(() => {
  document.body.innerHTML = "";
});

const PIXEL =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='4' height='4'><rect width='4' height='4' fill='red'/></svg>";

const visible = (el: Element | null | undefined) => !!el && !(el as HTMLElement).hidden;

describe("ui-avatar", () => {
  it("is a named image and shows initials; a loaded image replaces them", async () => {
    const host = mount(`<ui-avatar name="Ada Lovelace"></ui-avatar>`);
    const avatar = host.querySelector<UiAvatar>("ui-avatar")!;
    expect(await ax("image", "Ada Lovelace")).toBeTruthy();
    expect(avatar.shadowRoot?.querySelector("[part=fallback]")?.textContent).toBe("AL");
    avatar.src = PIXEL;
    await vi.waitFor(() => expect(visible(avatar.shadowRoot?.querySelector("img"))).toBe(true));
    expect(visible(avatar.shadowRoot?.querySelector("[part=fallback]"))).toBe(false);
  });

  it("holds the initials back while an image loads, then falls back when it fails", async () => {
    const host = mount(`<ui-avatar name="Grace Hopper" src="/missing-avatar.png"></ui-avatar>`);
    const avatar = host.querySelector<UiAvatar>("ui-avatar")!;
    const fallback = () => avatar.shadowRoot?.querySelector("[part=fallback]");
    expect(visible(fallback())).toBe(false);
    await wait(450);
    expect(visible(fallback())).toBe(true);
    expect(fallback()?.textContent).toBe("GH");
  });

  it("derives initials like the React kit", () => {
    expect(initials("ada")).toBe("AD");
    expect(initials("  Mary  Jane Watson ")).toBe("MW");
    expect(initials("")).toBe("");
  });
});

describe("ui-avatar-group", () => {
  it("overlaps its children with a surface ring", () => {
    const host = mount(
      `<ui-avatar-group><ui-avatar name="A B"></ui-avatar><ui-avatar name="C D"></ui-avatar></ui-avatar-group>`,
    );
    const [first, second] = host.querySelectorAll("ui-avatar");
    expect(getComputedStyle(first!).marginInlineStart).toBe("0px");
    expect(getComputedStyle(second!).marginInlineStart).toBe("-6px");
    expect(getComputedStyle(second!).boxShadow).not.toBe("none");
  });
});

describe("ui-progress and ui-meter", () => {
  it("is a progressbar with min, max and a percentage valuetext", async () => {
    const host = mount(`<ui-progress aria-label="Upload" value="40"></ui-progress>`);
    const node = await ax("progressbar", "Upload");
    expect(node).toBeTruthy();
    expect(node?.value).toBe(40);
    expect(host.querySelector<UiProgress>("ui-progress")?.valueText).toBe("40%");
    expect(node?.properties.valuemax).toBe(100);
  });

  it("is indeterminate without a valid value and completes at max", async () => {
    const host = mount(
      `<ui-progress aria-label="A"></ui-progress><ui-progress aria-label="B" value="500"></ui-progress>
       <ui-progress aria-label="C" value="3" max="3"></ui-progress><ui-progress aria-label="D" value="1" max="-2"></ui-progress>`,
    );
    const [a, b, c, d] = [...host.querySelectorAll<UiProgress>("ui-progress")];
    expect([a, b, c, d].map((el) => el!.dataset.state)).toEqual([
      "indeterminate",
      "indeterminate",
      "complete",
      "loading",
    ]);
    expect((await ax("progressbar", "A"))?.value).toBeUndefined();
    expect([a, b, c, d].map((el) => el!.valueText)).toEqual([null, null, "100%", "1%"]);
    expect((await ax("progressbar", "D"))?.properties.valuemax).toBe(100);
  });

  it("takes a custom value label and tracks value changes", async () => {
    const host = mount(`<ui-progress aria-label="Steps" value="1" max="4"></ui-progress>`);
    const progress = host.querySelector<UiProgress>("ui-progress")!;
    progress.valueLabel = (value, max) => `step ${value} of ${max}`;
    progress.value = 2;
    expect((await ax("progressbar", "Steps"))?.value).toBe(2);
    expect(progress.valueText).toBe("step 2 of 4");
    const bar = progress.shadowRoot!.querySelector<HTMLElement>("[part=indicator]")!;
    expect(bar.style.getPropertyValue("--ui-progress-gap")).toBe("50%");
  });

  it("ui-meter is a thinner progressbar", async () => {
    const host = mount(
      `<ui-progress aria-label="P" value="10"></ui-progress><ui-meter aria-label="M" value="10"></ui-meter>`,
    );
    expect(await ax("progressbar", "M")).toBeTruthy();
    const [p, m] = host.children as unknown as HTMLElement[];
    expect(getComputedStyle(p!).blockSize).toBe("6px");
    expect(getComputedStyle(m!).blockSize).toBe("5px");
  });
});

describe("ui-led and ui-status-dot", () => {
  it("keep the label in the accessibility tree and show it only on request", () => {
    const host = mount(
      `<ui-led label="Online"></ui-led><ui-led label="Away" show-label status="warning"></ui-led>
       <ui-status-dot tone="danger" label="Failed" show-label shape="square"></ui-status-dot>`,
    );
    const [hidden, shown, dot] = [...host.children] as HTMLElement[];
    const label = (el: HTMLElement) => el.shadowRoot!.querySelector<HTMLElement>("[part=label]")!;
    expect(label(hidden!).textContent).toBe("Online");
    expect(label(hidden!).getBoundingClientRect().width).toBeLessThanOrEqual(1);
    expect(label(shown!).getBoundingClientRect().width).toBeGreaterThan(10);
    expect(label(dot!).textContent).toBe("Failed");
    const color = (el: HTMLElement) =>
      getComputedStyle(el.shadowRoot!.querySelector("[part=dot]")!).backgroundColor;
    expect(color(hidden!)).not.toBe(color(shown!));
  });
});

describe("ui-status-pill", () => {
  it("is a disabled named button until interactive", async () => {
    const host = mount(`<ui-status-pill status="danger" label="Offline"></ui-status-pill>`);
    const pill = host.querySelector<UiStatusPill>("ui-status-pill")!;
    const node = await ax("button", "Offline");
    expect(node?.properties.disabled).toBe(true);
    expect(pill.tabIndex).toBe(-1);
    const selected = vi.fn();
    pill.addEventListener("select", selected);
    pill.click();
    expect(selected).not.toHaveBeenCalled();
    pill.interactive = true;
    expect((await ax("button", "Offline"))?.properties.disabled).toBeUndefined();
    expect(pill.tabIndex).toBe(0);
  });

  it("selects with click, Enter and Space", async () => {
    const host = mount(`<ui-status-pill interactive label="Synced"></ui-status-pill>`);
    const pill = host.querySelector<UiStatusPill>("ui-status-pill")!;
    const selected = vi.fn();
    pill.addEventListener("select", selected);
    pill.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    pill.click();
    expect(selected).toHaveBeenCalledTimes(3);
  });
});

describe("ui-chip", () => {
  it("prefixes status tones with a glyph unless an icon is slotted", async () => {
    const host = mount(
      `<ui-chip tone="success" status-icon>Paid</ui-chip>
       <ui-chip tone="danger" status-icon><svg slot="icon" width="12" height="12"></svg>Late</ui-chip>
       <ui-chip tone="accent" status-icon>Plain</ui-chip>`,
    );
    await wait(20);
    const status = (el: Element) => el.shadowRoot!.querySelector<HTMLElement>("[part=status]")!;
    const [paid, late, plain] = [...host.children];
    expect(status(paid!).hidden).toBe(false);
    expect(status(paid!).querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(status(late!).hidden).toBe(true);
    expect(status(plain!).hidden).toBe(true);
    expect(getComputedStyle(paid!).color).not.toBe(getComputedStyle(plain!).color);
  });
});

describe("ui-trend-chip", () => {
  it("matches the React trend logic value for value", () => {
    for (const value of [-250, -12.5, -0.04, 0, 0.04, 0.5, 3, 12.5, 99.95, 1234.56, Number.NaN]) {
      for (const epsilon of [0, 0.05, 1]) {
        const direction = trendDirection(value, epsilon);
        expect(elementDirection(value, epsilon)).toBe(direction);
        for (const invert of [false, true])
          expect(elementTone(direction, invert)).toBe(trendTone(direction, invert));
      }
      expect(elementFormatTrend(value)).toBe(formatTrend(value));
      expect(elementFormatTrend(value, "en-US", 2)).toBe(formatTrend(value, "en-US", 2));
    }
  });

  it("reads direction, tone and value for assistive technology", () => {
    const host = mount(
      `<ui-trend-chip value="12.5" label="vs. semana pasada"></ui-trend-chip>
       <ui-trend-chip value="-3" invert></ui-trend-chip>`,
    );
    const [up, down] = [...host.children] as HTMLElement[];
    const text = (el: HTMLElement) => el.shadowRoot!.textContent;
    expect(up!.dataset.tone).toBe("positive");
    expect(text(up!)).toContain("sube, favorable: ");
    expect(text(up!)).toContain(formatTrend(12.5));
    expect(up!.shadowRoot!.querySelector<HTMLElement>("[part=label]")!.hidden).toBe(false);
    expect(down!.dataset.tone).toBe("positive");
    expect(text(down!)).toContain("baja, favorable: ");
    expect(down!.shadowRoot!.querySelector<HTMLElement>("[part=label]")!.hidden).toBe(true);
  });
});
