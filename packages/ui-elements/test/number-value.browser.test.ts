import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { formatNumber, tweenValue } from "../../ui/src/atoms/number-value/format.ts";
import { defineNumberValue, type UiNumberValue } from "../src/number-value/number-value.ts";
import { mount, wait } from "./setup.ts";

beforeAll(() => {
  defineNumberValue();
});

afterEach(() => {
  document.body.innerHTML = "";
});

const parts = (el: Element) => ({
  visual: el.shadowRoot!.querySelector<HTMLElement>("[part=value]")!,
  text: el.shadowRoot!.querySelector<HTMLElement>("[part=text]")!,
});

describe("ui-number-value", () => {
  it("formats like the React kit and hides the animated text from assistive technology", async () => {
    const format = { style: "currency", currency: "PEN" } as const;
    const host = mount(
      `<ui-number-value value="1234.5" duration="0" format='${JSON.stringify(format)}'></ui-number-value>`,
    );
    const { visual, text } = parts(host.firstElementChild!);
    const expected = formatNumber(1234.5, format);
    expect(visual.textContent).toBe(expected);
    expect(text.textContent).toBe(expected);
    expect(visual.getAttribute("aria-hidden")).toBe("true");
    expect(text.hasAttribute("aria-hidden")).toBe(false);
    host.firstElementChild!.setAttribute("locale", "en-US");
    expect(parts(host.firstElementChild!).text.textContent).toBe(
      formatNumber(1234.5, { ...format, locale: "en-US" }),
    );
  });

  it("counts up from `from`, keeping the final value readable throughout", async () => {
    const host = mount(`<ui-number-value value="1000" from="0" duration="400"></ui-number-value>`);
    const el = host.firstElementChild as UiNumberValue;
    const { visual, text } = parts(el);
    const final = formatNumber(1000);
    expect(text.textContent).toBe(final);
    await wait(120);
    expect(visual.textContent).not.toBe(final);
    expect(visual.textContent).not.toBe(formatNumber(0));
    await wait(500);
    expect(visual.textContent).toBe(final);
    expect(tweenValue(0, 1000, 0.5)).toBeGreaterThan(500);
  });

  it("animates only later changes with animate-on-mount=false, from the shown value", async () => {
    const host = mount(
      `<ui-number-value value="50" animate-on-mount="false" duration="400"></ui-number-value>`,
    );
    const el = host.firstElementChild as UiNumberValue;
    const { visual } = parts(el);
    expect(visual.textContent).toBe(formatNumber(50));
    el.value = 150;
    await wait(100);
    const mid = visual.textContent;
    expect(mid).not.toBe(formatNumber(50));
    expect(mid).not.toBe(formatNumber(150));
    await wait(500);
    expect(visual.textContent).toBe(formatNumber(150));
  });

  it("takes format options from the property too", () => {
    const host = mount(`<ui-number-value value="0.256" duration="0"></ui-number-value>`);
    const el = host.firstElementChild as UiNumberValue;
    el.format = { style: "percent", locale: "en-US" };
    expect(parts(el).text.textContent).toBe("26%");
  });
});
