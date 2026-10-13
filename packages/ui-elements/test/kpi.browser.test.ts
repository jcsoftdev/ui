import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { formatNumber } from "../../ui/src/atoms/number-value/format.ts";
import { defineKpi } from "../src/kpi/kpi.ts";
import { mount } from "./setup.ts";

beforeAll(() => {
  defineKpi();
});

afterEach(() => {
  document.body.innerHTML = "";
});

const part = (el: Element, name: string) =>
  el.shadowRoot!.querySelector<HTMLElement>(`[part=${name}]`)!;

describe("ui-kpi", () => {
  it("shows label, value, suffix and description, hiding the parts it lacks", () => {
    const host = mount(
      `<ui-kpi label="Open" value="7" suffix="/12" description="This week"></ui-kpi><ui-kpi label="Only label"></ui-kpi>`,
    );
    const [full, bare] = Array.from(host.children);
    expect(part(full!, "label").textContent).toBe("Open");
    expect(part(full!, "value").textContent).toBe("7/12");
    expect(part(full!, "description").textContent).toBe("This week");
    expect(part(bare!, "description").hidden).toBe(true);
    expect(part(bare!, "suffix").hidden).toBe(true);
  });

  it("formats a numeric value with Intl options only when asked", () => {
    const host = mount(
      `<ui-kpi value="1234567.5"></ui-kpi><ui-kpi value="1234567.5" locale="en-US" format='{"notation":"compact"}'></ui-kpi><ui-kpi value="S/ 1,200"></ui-kpi>`,
    );
    const [plain, formatted, text] = Array.from(host.children);
    expect(part(plain!, "value").textContent).toBe("1234567.5");
    expect(part(formatted!, "value").textContent).toBe(
      formatNumber(1234567.5, { locale: "en-US", notation: "compact" }),
    );
    expect(part(text!, "value").textContent).toBe("S/ 1,200");
  });

  it("lets a slotted part replace the attribute and uses the danger colour", () => {
    const host = mount(
      `<ui-kpi label="Late" value="3" variant="danger"><b slot="label">Rich</b></ui-kpi>`,
    );
    const el = host.firstElementChild!;
    const slot = el.shadowRoot!.querySelector<HTMLSlotElement>("slot[name=label]")!;
    expect(slot.assignedNodes()).toHaveLength(1);
    expect(getComputedStyle(part(el, "value")).color).not.toBe(
      getComputedStyle(
        mount(`<ui-kpi value="3"></ui-kpi>`).firstElementChild!.shadowRoot!.querySelector(
          "[part=value]",
        )!,
      ).color,
    );
  });

  it("shrinks the value in a narrow tile", () => {
    const host = mount(
      `<div style="width:120px"><ui-kpi value="9"></ui-kpi></div><div style="width:300px"><ui-kpi value="9"></ui-kpi></div>`,
    );
    const [narrow, wide] = Array.from(host.querySelectorAll("ui-kpi")).map(
      (el) => getComputedStyle(part(el, "value")).fontSize,
    );
    expect(narrow).toBe("22px");
    expect(wide).toBe("30px");
  });
});
