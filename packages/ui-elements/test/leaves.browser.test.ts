import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { defineButton, type UiButton } from "../src/button/button.ts";
import { defineCheckbox, type UiCheckbox } from "../src/checkbox/checkbox.ts";
import { defineInput, type UiInput } from "../src/input/input.ts";
import { defineRadioGroup, type UiRadioGroup } from "../src/radio-group/radio-group.ts";
import { defineSwitch, type UiSwitch } from "../src/switch/switch.ts";
import { ax, mount } from "./setup.ts";

beforeAll(() => {
  defineButton();
  defineInput();
  defineCheckbox();
  defineSwitch();
  defineRadioGroup();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("ui-button", () => {
  it("is a named button, activates with Enter and Space, and stays inert while disabled", async () => {
    const host = mount(`<ui-button variant="primary">Save</ui-button>`);
    const button = host.querySelector<UiButton>("ui-button")!;
    const clicks = vi.fn();
    button.addEventListener("click", clicks);
    expect(await ax("button", "Save")).toBeTruthy();
    expect(await ax("button", "Nope")).toBeUndefined();
    button.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    expect(clicks).toHaveBeenCalledTimes(2);
    button.disabled = true;
    expect((await ax("button", "Save"))?.properties.disabled).toBe(true);
    expect(button.tabIndex).toBe(-1);
    button.click();
    expect(clicks).toHaveBeenCalledTimes(2);
  });

  it("submits and resets its form", async () => {
    const host = mount(`<form><ui-input name="q" value="a"></ui-input>
      <ui-button type="submit">Go</ui-button><ui-button type="reset">Reset</ui-button></form>`);
    const form = host.querySelector("form")!;
    const submit = vi.fn((event: Event) => event.preventDefault());
    form.addEventListener("submit", submit);
    const input = host.querySelector<UiInput>("ui-input")!;
    input.value = "changed";
    host.querySelector<UiButton>("ui-button[type=submit]")!.click();
    await Promise.resolve();
    expect(submit).toHaveBeenCalledTimes(1);
    host.querySelector<UiButton>("ui-button[type=reset]")!.click();
    await Promise.resolve();
    expect(input.value).toBe("a");
  });

  it("lets a click listener cancel the submit of a real pointer click", async () => {
    const host = mount(`<form><ui-button type="submit">Go</ui-button></form>`);
    const submit = vi.fn((event: Event) => event.preventDefault());
    host.querySelector("form")!.addEventListener("submit", submit);
    const button = host.querySelector<UiButton>("ui-button")!;
    const cancel = (event: Event) => event.preventDefault();
    button.addEventListener("click", cancel);
    await userEvent.click(button);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(submit).not.toHaveBeenCalled();
    button.removeEventListener("click", cancel);
    await userEvent.click(button);
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("registers under a custom prefix", () => {
    expect(defineButton({ prefix: "acme" })).toBe("acme-button");
    const host = mount(`<acme-button>Hi</acme-button>`);
    expect(host.querySelector("acme-button")?.shadowRoot).not.toBeNull();
  });
});

describe("ui-input", () => {
  it("submits its value, mirrors validity and takes its name from a label", async () => {
    const host = mount(`<form><label for="email">Email</label>
      <ui-input id="email" name="email" type="email" required></ui-input></form>`);
    const form = host.querySelector("form")!;
    const input = host.querySelector<UiInput>("ui-input")!;
    await Promise.resolve();
    expect(input.checkValidity()).toBe(false);
    expect(input.validity.valueMissing).toBe(true);
    await userEvent.click(host.querySelector("label")!);
    await userEvent.keyboard("me@example.com");
    expect(new FormData(form).get("email")).toBe("me@example.com");
    expect(input.checkValidity()).toBe(true);
    expect(await ax("textbox", "Email")).toBeTruthy();
  });

  it("re-dispatches change from the host and follows a disabled fieldset", async () => {
    const host = mount(
      `<form><fieldset><ui-input name="x" label="X"></ui-input></fieldset></form>`,
    );
    const input = host.querySelector<UiInput>("ui-input")!;
    const change = vi.fn();
    input.addEventListener("change", change);
    await userEvent.click(input);
    await userEvent.keyboard("abc");
    await userEvent.tab();
    expect(change).toHaveBeenCalledTimes(1);
    host.querySelector("fieldset")!.disabled = true;
    await Promise.resolve();
    expect(input.input.disabled).toBe(true);
  });
});

describe("ui-checkbox and ui-switch", () => {
  it("toggles with Space and clicks, reports aria-checked and submits while checked", async () => {
    const host = mount(`<form><ui-checkbox name="terms" required>Accept</ui-checkbox>
      <ui-switch name="wifi" value="yes" checked>Wi-Fi</ui-switch></form>`);
    const form = host.querySelector("form")!;
    const checkbox = host.querySelector<UiCheckbox>("ui-checkbox")!;
    const toggle = host.querySelector<UiSwitch>("ui-switch")!;
    expect((await ax("checkbox", "Accept"))?.properties.checked).toBe("false");
    expect((await ax("switch", "Wi-Fi"))?.properties.checked).toBe("true");
    expect(checkbox.checkValidity()).toBe(false);
    checkbox.focus();
    await userEvent.keyboard(" ");
    expect(checkbox.checked).toBe(true);
    expect(checkbox.dataset.state).toBe("checked");
    expect(checkbox.checkValidity()).toBe(true);
    await userEvent.click(toggle);
    const data = new FormData(form);
    expect(data.get("terms")).toBe("on");
    expect(data.get("wifi")).toBeNull();
    toggle.focus();
    await userEvent.keyboard("{Enter}");
    expect(new FormData(form).get("wifi")).toBe("yes");
    form.reset();
    expect(checkbox.checked).toBe(false);
    expect(toggle.checked).toBe(true);
  });

  it("shows indeterminate as mixed and clears it on toggle", async () => {
    const host = mount(`<ui-checkbox indeterminate>All</ui-checkbox>`);
    const checkbox = host.querySelector<UiCheckbox>("ui-checkbox")!;
    expect((await ax("checkbox", "All"))?.properties.checked).toBe("mixed");
    checkbox.toggle();
    expect(checkbox.indeterminate).toBe(false);
    expect(checkbox.checked).toBe(true);
  });
});

describe("ui-radio-group", () => {
  it("roves with arrows, selects on move, keeps one tab stop and submits", async () => {
    const host = mount(`<form><button id="before">before</button>
      <ui-radio-group name="size" value="m" aria-label="Size">
        <ui-radio value="s">Small</ui-radio><ui-radio value="m">Medium</ui-radio>
        <ui-radio value="l" disabled>Large</ui-radio><ui-radio value="xl">XL</ui-radio>
      </ui-radio-group></form>`);
    const group = host.querySelector<UiRadioGroup>("ui-radio-group")!;
    const radios = [...host.querySelectorAll<HTMLElement>("ui-radio")];
    expect(radios.map((radio) => radio.tabIndex)).toEqual([-1, 0, -1, -1]);
    expect(await ax("radiogroup", "Size")).toBeTruthy();
    expect((await ax("radio", "Medium"))?.properties.checked).toBe("true");
    const change = vi.fn();
    group.addEventListener("change", change);
    host.querySelector<HTMLElement>("#before")!.focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(radios[1]);
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(radios[3]);
    expect(group.value).toBe("xl");
    await userEvent.keyboard("{ArrowRight}");
    expect(group.value).toBe("s");
    expect(change).toHaveBeenCalledTimes(2);
    expect(new FormData(host.querySelector("form")!).get("size")).toBe("s");
    await userEvent.click(radios[2]!);
    expect(group.value).toBe("s");
  });

  it("is invalid while required and empty", () => {
    const host = mount(
      `<ui-radio-group required><ui-radio value="a">A</ui-radio></ui-radio-group>`,
    );
    const group = host.querySelector<UiRadioGroup>("ui-radio-group")!;
    expect(group.checkValidity()).toBe(false);
    group.value = "a";
    expect(group.checkValidity()).toBe(true);
  });
});
