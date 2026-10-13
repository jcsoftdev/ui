import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { defineAccentPicker, type UiAccentPicker } from "../src/accent-picker/accent-picker.ts";
import {
  defineCheckboxButtonGroup,
  type UiCheckboxButtonGroup,
} from "../src/checkbox-button-group/checkbox-button-group.ts";
import {
  defineRadioButtonGroup,
  type UiRadioButtonGroup,
} from "../src/radio-button-group/radio-button-group.ts";
import { ax, mount } from "./setup.ts";

beforeAll(() => {
  defineRadioButtonGroup();
  defineCheckboxButtonGroup();
  defineAccentPicker();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("ui-radio-button-group", () => {
  const html = `<form><fieldset><ui-radio-button-group name="plan" value="pro" aria-label="Plan">
    <ui-radio-button value="free">Free<span slot="description">For hobbies</span></ui-radio-button>
    <ui-radio-button value="pro">Pro</ui-radio-button>
    <ui-radio-button value="biz" disabled>Business</ui-radio-button>
    <ui-radio-button value="ent">Enterprise</ui-radio-button>
  </ui-radio-button-group></fieldset></form>`;

  it("is a radiogroup with one tab stop, arrows that select and skip disabled cards", async () => {
    const host = mount(html);
    const group = host.querySelector<UiRadioButtonGroup>("ui-radio-button-group")!;
    const cards = [...host.querySelectorAll<HTMLElement>("ui-radio-button")];
    expect(cards.map((card) => card.tabIndex)).toEqual([-1, 0, -1, -1]);
    expect(await ax("radiogroup", "Plan")).toBeTruthy();
    expect((await ax("radio", "Pro"))?.properties.checked).toBe("true");
    expect((await ax("radio", "Business"))?.properties.disabled).toBe(true);

    const changes = vi.fn();
    group.addEventListener("change", changes);
    cards[1]!.focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(cards[3]);
    expect(group.value).toBe("ent");
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(cards[0]);
    expect(group.value).toBe("free");
    expect(changes).toHaveBeenCalledTimes(2);
    expect(cards.map((card) => card.tabIndex)).toEqual([0, -1, -1, -1]);
    await userEvent.click(cards[2]!);
    expect(group.value).toBe("free");
  });

  it("submits, requires a choice, resets and follows a disabled fieldset", () => {
    const host = mount(
      html
        .replace('value="pro" ', "")
        .replace("<ui-radio-button-group ", "<ui-radio-button-group required "),
    );
    const form = host.querySelector("form")!;
    const group = host.querySelector<UiRadioButtonGroup>("ui-radio-button-group")!;
    expect(group.validity.valueMissing).toBe(true);
    expect(new FormData(form).has("plan")).toBe(false);
    host.querySelectorAll<HTMLElement>("ui-radio-button")[0]!.click();
    expect(new FormData(form).get("plan")).toBe("free");
    expect(group.checkValidity()).toBe(true);
    form.reset();
    expect(group.value).toBe("");
    group.value = "ent";
    host.querySelector("fieldset")!.disabled = true;
    expect(new FormData(form).has("plan")).toBe(false);
    host.querySelectorAll<HTMLElement>("ui-radio-button")[0]!.click();
    expect(group.value).toBe("ent");
  });
});

describe("ui-checkbox-button-group", () => {
  const html = `<form><ui-checkbox-button-group name="tags" value="a" aria-label="Tags">
    <ui-checkbox-button value="a">Alpha</ui-checkbox-button>
    <ui-checkbox-button value="b">Beta</ui-checkbox-button>
    <ui-checkbox-button value="c" disabled>Gamma</ui-checkbox-button>
  </ui-checkbox-button-group></form>`;

  it("is a group of checkboxes with their own tab stops, toggled by Space", async () => {
    const host = mount(html);
    const group = host.querySelector<UiCheckboxButtonGroup>("ui-checkbox-button-group")!;
    const boxes = [...host.querySelectorAll<HTMLElement>("ui-checkbox-button")];
    expect(await ax("group", "Tags")).toBeTruthy();
    expect((await ax("checkbox", "Alpha"))?.properties.checked).toBe("true");
    expect((await ax("checkbox", "Beta"))?.properties.checked).toBe("false");
    expect(boxes.map((box) => box.tabIndex)).toEqual([0, 0, -1]);
    const changes = vi.fn();
    group.addEventListener("change", changes);
    await userEvent.tab();
    await userEvent.tab();
    expect(document.activeElement).toBe(boxes[1]);
    await userEvent.keyboard(" ");
    expect(group.values).toEqual(["a", "b"]);
    await userEvent.click(boxes[0]!);
    expect(group.values).toEqual(["b"]);
    await userEvent.click(boxes[2]!);
    expect(group.values).toEqual(["b"]);
    expect(changes).toHaveBeenCalledTimes(2);
  });

  it("submits one entry per checked value, requires one, and resets", () => {
    const host = mount(
      html.replace("<ui-checkbox-button-group ", "<ui-checkbox-button-group required "),
    );
    const form = host.querySelector("form")!;
    const group = host.querySelector<UiCheckboxButtonGroup>("ui-checkbox-button-group")!;
    const boxes = [...host.querySelectorAll<HTMLElement>("ui-checkbox-button")];
    boxes[1]!.click();
    expect(new FormData(form).getAll("tags")).toEqual(["a", "b"]);
    boxes[0]!.click();
    boxes[1]!.click();
    expect(group.validity.valueMissing).toBe(true);
    expect(new FormData(form).has("tags")).toBe(false);
    form.reset();
    expect(new FormData(form).getAll("tags")).toEqual(["a"]);
    expect(group.checkValidity()).toBe(true);
  });
});

describe("ui-accent-picker", () => {
  it("defaults to the first option, exposes data-accent and moves with the arrows", async () => {
    const host = mount(`<form><ui-accent-picker name="accent" aria-label="Accent">
      <ui-accent-option value="rose" swatch="rgb(255, 0, 0)">Rose</ui-accent-option>
      <ui-accent-option value="sky" swatch="var(--accent)">Sky</ui-accent-option>
    </ui-accent-picker></form>`);
    const picker = host.querySelector<UiAccentPicker>("ui-accent-picker")!;
    const options = [...host.querySelectorAll<HTMLElement>("ui-accent-option")];
    expect(picker.value).toBe("rose");
    expect(picker.dataset.accent).toBe("rose");
    expect(new FormData(host.querySelector("form")!).get("accent")).toBe("rose");
    expect(await ax("radiogroup", "Accent")).toBeTruthy();
    expect((await ax("radio", "Rose"))?.properties.checked).toBe("true");
    expect(
      getComputedStyle(options[0]!.shadowRoot!.querySelector("[part=swatch]")!).backgroundColor,
    ).toBe("rgb(255, 0, 0)");
    options[0]!.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(picker.value).toBe("sky");
    expect(picker.dataset.accent).toBe("sky");
    host.querySelector("form")!.reset();
    expect(picker.value).toBe("rose");
  });
});

describe("custom prefix", () => {
  it("registers the groups and their parts under another prefix", () => {
    expect(defineRadioButtonGroup({ prefix: "acme" })).toBe("acme-radio-button-group");
    expect(customElements.get("acme-radio-button")).toBeTruthy();
    expect(defineCheckboxButtonGroup({ prefix: "acme" })).toBe("acme-checkbox-button-group");
    expect(defineAccentPicker({ prefix: "acme" })).toBe("acme-accent-picker");
  });
});
