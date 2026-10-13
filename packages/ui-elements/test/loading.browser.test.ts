import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { commands } from "vitest/browser";
import { defineLoader } from "../src/loader/loader.ts";
import { defineSkeleton } from "../src/skeleton/skeleton.ts";
import { defineTextShimmer } from "../src/text-shimmer/text-shimmer.ts";
import { ax, mount } from "./setup.ts";

beforeAll(() => {
  defineSkeleton();
  defineLoader();
  defineTextShimmer();
});

afterEach(async () => {
  document.body.innerHTML = "";
  await commands.reducedMotion("no-preference");
});

const parts = (host: Element, part: string) => host.shadowRoot?.querySelectorAll(`[part=${part}]`);

describe("ui-skeleton", () => {
  it("is a busy status named Loading, or by label", async () => {
    mount("<ui-skeleton></ui-skeleton>");
    const node = await ax("status", "Loading");
    expect(node?.properties.busy).toBeTruthy();
    document.body.innerHTML = "";
    mount('<ui-skeleton label="Loading orders"></ui-skeleton>');
    expect(await ax("status", "Loading orders")).toBeTruthy();
  });

  it("builds the variants and clamps the counts", () => {
    const lines = mount('<ui-skeleton lines="4"></ui-skeleton>').firstElementChild as HTMLElement;
    expect(parts(lines, "line")).toHaveLength(4);
    const table = mount('<ui-skeleton variant="table" rows="50"></ui-skeleton>')
      .firstElementChild as HTMLElement;
    expect(parts(table, "row")).toHaveLength(12);
    const card = mount('<ui-skeleton variant="card"></ui-skeleton>')
      .firstElementChild as HTMLElement;
    expect(parts(card, "card")).toHaveLength(1);
    const last = parts(lines, "line")?.[3] as HTMLElement;
    const stack = last.parentElement as HTMLElement;
    expect(last.getBoundingClientRect().width / stack.getBoundingClientRect().width).toBeCloseTo(
      0.6,
      1,
    );
  });

  it("pulses, and stops with reduced motion", async () => {
    const host = mount("<ui-skeleton></ui-skeleton>").firstElementChild as HTMLElement;
    expect(getComputedStyle(host).animationName).toBe("ui-skeleton-pulse");
    await commands.reducedMotion("reduce");
    expect(getComputedStyle(host).animationName).toBe("none");
  });
});

describe("ui-loader", () => {
  it("is a status; the dots variant hides the label visually only", async () => {
    const host = mount('<ui-loader label="Thinking"></ui-loader>').firstElementChild as HTMLElement;
    expect(await ax("status")).toBeTruthy();
    expect(host.shadowRoot?.textContent).toContain("Thinking");
    const label = host.shadowRoot?.querySelector("[part=label]") as HTMLElement;
    expect(label.getBoundingClientRect().width).toBeLessThanOrEqual(1);
    host.setAttribute("variant", "typing");
    expect(label.getBoundingClientRect().width).toBeGreaterThan(1);
  });

  it("animates the dots, and keeps them still with reduced motion", async () => {
    const host = mount("<ui-loader></ui-loader>").firstElementChild as HTMLElement;
    const dot = host.shadowRoot?.querySelector("[part=dot]") as HTMLElement;
    expect(getComputedStyle(dot).animationName).toBe("ui-loader-dot");
    await commands.reducedMotion("reduce");
    expect(getComputedStyle(dot).animationName).toBe("none");
  });
});

describe("ui-text-shimmer", () => {
  it("sweeps with the given duration, and is static with reduced motion", async () => {
    const host = mount('<ui-text-shimmer duration="3">Thinking…</ui-text-shimmer>')
      .firstElementChild as HTMLElement;
    const style = getComputedStyle(host);
    expect(style.animationName).toBe("ui-text-shimmer");
    expect(style.animationDuration).toBe("3s");
    expect(style.backgroundImage).toContain("linear-gradient");
    await commands.reducedMotion("reduce");
    expect(getComputedStyle(host).animationName).toBe("none");
    expect(getComputedStyle(host).backgroundImage).toBe("none");
  });

  it("registers under a custom prefix", () => {
    expect(defineSkeleton({ prefix: "acme" })).toBe("acme-skeleton");
    expect(defineLoader({ prefix: "acme" })).toBe("acme-loader");
    expect(defineTextShimmer({ prefix: "acme" })).toBe("acme-text-shimmer");
  });
});
