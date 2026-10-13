import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { defineDialog, type UiDialog } from "../src/dialog/dialog.ts";
import { defineInlineSelect, type UiInlineSelect } from "../src/inline-select/inline-select.ts";
import { defineSelect, type UiSelect } from "../src/select/select.ts";
import { ax, frame, mount, wait } from "./setup.ts";

beforeAll(() => {
  defineSelect();
  defineInlineSelect();
  defineDialog();
});

afterEach(() => {
  document.body.innerHTML = "";
});

const SELECT = (attrs = "") => `<form id="f">
  <label for="s">Plan</label>
  <ui-select id="s" name="plan" ${attrs}>
    <option value="free">Free</option>
    <option value="pro">Pro</option>
    <option value="legacy" disabled>Legacy</option>
    <optgroup label="Teams"><option value="team">Team</option><option value="org">Organisation</option></optgroup>
  </ui-select></form>`;

const popup = (select: HTMLElement) =>
  select.shadowRoot!.querySelector<HTMLElement>("[part=popup]")!;
const trigger = (select: HTMLElement) =>
  select.shadowRoot!.querySelector<HTMLElement>("[part=trigger]")!;
const option = (select: HTMLElement, value: string) =>
  select.shadowRoot!.querySelector<HTMLElement>(`[role=option][data-value=${value}]`)!;

describe("ui-select", () => {
  it("is a named combobox with a listbox of options, groups and the selected state", async () => {
    const host = mount(SELECT());
    const select = host.querySelector<UiSelect>("ui-select")!;
    await wait(60);
    const combobox = await ax("combobox", "Plan");
    expect(combobox).toBeTruthy();
    expect(combobox?.properties.expanded).toBe(false);
    expect(select.value).toBe("free");
    await userEvent.click(trigger(select));
    expect(select.open).toBe(true);
    expect(popup(select).matches(":popover-open")).toBe(true);
    expect((await ax("combobox", "Plan"))?.properties.expanded).toBe(true);
    expect(await ax("listbox")).toBeTruthy();
    expect((await ax("option", "Free"))?.properties.selected).toBe(true);
    expect((await ax("option", "Pro"))?.properties.selected).toBe(false);
    expect(await ax("group", "Teams")).toBeTruthy();
    expect(option(select, "legacy").getAttribute("aria-disabled")).toBe("true");
  });

  it("opens with the keyboard, moves, types ahead, commits and keeps focus on the trigger", async () => {
    const host = mount(SELECT());
    const select = host.querySelector<UiSelect>("ui-select")!;
    const input = vi.fn();
    const change = vi.fn();
    select.addEventListener("input", input);
    select.addEventListener("change", change);
    select.focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(select.open).toBe(true);
    expect(trigger(select).getAttribute("aria-activedescendant")).toBe(option(select, "free").id);
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    // the disabled option is skipped
    expect(option(select, "team").hasAttribute("data-active")).toBe(true);
    await userEvent.keyboard("{Enter}");
    expect(select.value).toBe("team");
    expect(select.open).toBe(false);
    expect(trigger(select).textContent).toContain("Team");
    expect(input).toHaveBeenCalledTimes(1);
    expect(change).toHaveBeenCalledTimes(1);
    expect(select.shadowRoot!.activeElement).toBe(trigger(select));
    await userEvent.keyboard("o");
    expect(select.open).toBe(true);
    expect(option(select, "org").hasAttribute("data-active")).toBe(true);
    await userEvent.keyboard("{Escape}");
    expect(select.open).toBe(false);
    expect(select.value).toBe("team");
  });

  it("picks with the pointer and dismisses on an outside press", async () => {
    const host = mount(`<button id="away">Away</button>${SELECT()}`);
    const select = host.querySelector<UiSelect>("ui-select")!;
    await userEvent.click(trigger(select));
    await userEvent.click(option(select, "pro"));
    expect(select.value).toBe("pro");
    expect(select.open).toBe(false);
    await userEvent.click(trigger(select));
    expect(select.open).toBe(true);
    await userEvent.click(host.querySelector("#away")!);
    expect(select.open).toBe(false);
    await wait(250);
    expect(popup(select).matches(":popover-open")).toBe(false);
  });

  it("takes part in a form: FormData, reset, required, placeholder and a disabled fieldset", async () => {
    const host = mount(
      `<form id="f"><fieldset id="fs"><ui-select name="plan" value="pro" required placeholder="Choose" aria-label="Plan">
        <option value="">None</option><option value="free">Free</option><option value="pro">Pro</option>
      </ui-select></fieldset></form>`,
    );
    const form = host.querySelector<HTMLFormElement>("#f")!;
    const select = host.querySelector<UiSelect>("ui-select")!;
    await frame();
    expect(new FormData(form).get("plan")).toBe("pro");
    select.value = "free";
    expect(new FormData(form).get("plan")).toBe("free");
    form.reset();
    expect(select.value).toBe("pro");
    select.value = "";
    expect(select.checkValidity()).toBe(false);
    expect(select.validity.valueMissing).toBe(true);
    expect(trigger(select).textContent).toContain("Choose");
    host.querySelector<HTMLFieldSetElement>("#fs")!.disabled = true;
    expect(select.disabled).toBe(true);
    expect(trigger(select).hasAttribute("disabled")).toBe(true);
    select.value = "pro";
    select.show();
    expect(select.open).toBe(false);
  });

  it("renders the options property with groups and no children", async () => {
    const host = mount(`<ui-select name="x" aria-label="Pick"></ui-select>`);
    const select = host.querySelector<UiSelect>("ui-select")!;
    select.options = [
      { value: "a", label: "Alpha" },
      { label: "More", options: [{ value: "b", label: "Beta" }] },
    ];
    await frame();
    expect(select.value).toBe("a");
    select.value = "b";
    expect(trigger(select).textContent).toContain("Beta");
    expect(await ax("combobox", "Pick")).toBeTruthy();
  });

  it("closes on Escape inside a modal dialog without closing the dialog", async () => {
    const host = mount(`<ui-dialog><div data-dialog-body>${SELECT()}</div></ui-dialog>`);
    const dialog = host.querySelector<UiDialog>("ui-dialog")!;
    dialog.show();
    const select = host.querySelector<UiSelect>("ui-select")!;
    await userEvent.click(trigger(select));
    expect(select.open).toBe(true);
    expect(popup(select).matches(":popover-open")).toBe(true);
    await userEvent.keyboard("{Escape}");
    expect(select.open).toBe(false);
    expect(dialog.open).toBe(true);
    await userEvent.keyboard("{Escape}");
    expect(dialog.open).toBe(false);
  });

  it("works under a custom prefix", async () => {
    defineSelect({ prefix: "acme" });
    const host = mount(
      `<acme-select aria-label="Size"><option value="s">Small</option></acme-select>`,
    );
    await frame();
    expect(await ax("combobox", "Size")).toBeTruthy();
  });
});

describe("ui-inline-select", () => {
  it("is the same combobox, drawn borderless", async () => {
    const host = mount(
      `<p>Repeat every <ui-inline-select name="every" aria-label="Unit">
        <option value="day">day</option><option value="week" selected>week</option></ui-inline-select></p>`,
    );
    const select = host.querySelector<UiInlineSelect>("ui-inline-select")!;
    await frame();
    expect(select.value).toBe("week");
    expect(await ax("combobox", "Unit")).toBeTruthy();
    expect(getComputedStyle(trigger(select)).borderTopWidth).toBe("0px");
    select.focus();
    await userEvent.keyboard("{ArrowDown}{ArrowUp}{Enter}");
    expect(select.value).toBe("day");
  });
});
