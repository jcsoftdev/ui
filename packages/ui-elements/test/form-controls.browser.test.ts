import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { defineField } from "../src/field/field.ts";
import { defineFormGrid } from "../src/form-grid/form-grid.ts";
import { defineInput, type UiInput } from "../src/input/input.ts";
import { defineInputIcon } from "../src/input-icon/input-icon.ts";
import { defineLabel } from "../src/label/label.ts";
import { defineNativeSelect, type UiNativeSelect } from "../src/native-select/native-select.ts";
import { defineTextarea, type UiTextarea } from "../src/textarea/textarea.ts";
import { ax, frame, mount } from "./setup.ts";

beforeAll(() => {
  defineLabel();
  defineField();
  defineFormGrid();
  defineInput();
  defineInputIcon();
  defineTextarea();
  defineNativeSelect();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("ui-label", () => {
  it("is a native label: names the control and focuses it on click", async () => {
    const host = mount(`<ui-label for="n">Full name</ui-label><ui-input id="n"></ui-input>
      <ui-label for="t">Notes</ui-label><ui-textarea id="t"></ui-textarea>`);
    await frame();
    expect(await ax("textbox", "Full name")).toBeTruthy();
    expect(await ax("textbox", "Notes")).toBeTruthy();
    host.querySelector<HTMLElement>("ui-label[for=n] > label")!.click();
    expect(document.activeElement).toBe(host.querySelector("ui-input"));
  });

  it("moves later children inside its label", async () => {
    const host = mount(`<ui-label for="x"></ui-label>`);
    const label = host.querySelector("ui-label")!;
    label.append("Late text");
    await Promise.resolve();
    expect(label.querySelector(":scope > label")?.textContent).toBe("Late text");
    expect(label.querySelector("label")?.htmlFor).toBe("x");
  });
});

describe("ui-field", () => {
  it("wires label, hint and error to a ui-input in the AX tree", async () => {
    const host = mount(`<ui-field label="Email" hint="We never share it" error="Required" optional>
      <ui-input name="email"></ui-input></ui-field>`);
    await frame();
    const input = host.querySelector<UiInput>("ui-input")!;
    const label = host.querySelector("label")!;
    expect(label.textContent).toBe("Email (optional)");
    expect(label.htmlFor).toBe(input.id);
    const ids = input.getAttribute("aria-describedby")!.split(" ");
    expect(ids).toEqual([`${input.id}-hint`, `${input.id}-error`]);
    const error = host.querySelector<HTMLElement>(`#${input.id}-error`)!;
    expect(error.getAttribute("role")).toBe("alert");
    const inner = input.input as HTMLInputElement & { ariaDescribedByElements?: Element[] };
    expect(inner.ariaDescribedByElements?.map((el) => el.id)).toEqual(ids);
    expect(inner.getAttribute("aria-invalid")).toBe("true");
    expect(await ax("textbox", "Email (optional)")).toBeTruthy();

    host.querySelector("ui-field")!.removeAttribute("error");
    expect(input.hasAttribute("aria-invalid")).toBe(false);
    expect(input.getAttribute("aria-describedby")).toBe(`${input.id}-hint`);
    expect(inner.getAttribute("aria-invalid")).not.toBe("true");
  });

  it("works with a native control and a ui-textarea", async () => {
    const host =
      mount(`<ui-field label="Bio" error="Too long"><ui-textarea></ui-textarea></ui-field>
      <ui-field label="Age"><input type="number"></ui-field>`);
    await frame();
    const area = host.querySelector<UiTextarea>("ui-textarea")!;
    expect(area.textarea.getAttribute("aria-invalid")).toBe("true");
    expect(await ax("textbox", "Bio")).toBeTruthy();
    expect(await ax("spinbutton", "Age")).toBeTruthy();
  });
});

describe("ui-form-grid", () => {
  it("is one column below 620px of its own width and two from there", async () => {
    const host = mount(
      `<div style="width:400px"><ui-form-grid><i>1</i><i>2</i></ui-form-grid></div>`,
    );
    const grid = host.querySelector("ui-form-grid")!;
    const columns = () =>
      getComputedStyle(grid.shadowRoot!.querySelector("[part=grid]")!).gridTemplateColumns.split(
        " ",
      ).length;
    expect(columns()).toBe(1);
    host.querySelector<HTMLElement>("div")!.style.width = "700px";
    await frame();
    expect(columns()).toBe(2);
  });
});

describe("ui-input-icon", () => {
  it("hides the icon from assistive technology and makes room for it", async () => {
    const host = mount(`<ui-input-icon><svg slot="icon" viewBox="0 0 8 8"></svg>
      <ui-input aria-label="Search"></ui-input></ui-input-icon>`);
    await Promise.resolve();
    expect(host.querySelector("svg")!.getAttribute("aria-hidden")).toBe("true");
    const input = host.querySelector<UiInput>("ui-input")!.input;
    expect(getComputedStyle(input).paddingInlineStart).toBe("32px");
    expect(await ax("textbox", "Search")).toBeTruthy();
  });
});

describe("ui-textarea", () => {
  it("is a named textbox that submits, validates, resets and follows a disabled fieldset", async () => {
    const host = mount(`<form><fieldset><label for="m">Message</label>
      <ui-textarea id="m" name="m" value="hi" required minlength="3" rows="4"></ui-textarea>
      </fieldset></form>`);
    await frame();
    const form = host.querySelector("form")!;
    const area = host.querySelector<UiTextarea>("ui-textarea")!;
    expect(await ax("textbox", "Message")).toBeTruthy();
    expect(new FormData(form).get("m")).toBe("hi");
    expect(area.textarea.rows).toBe(4);

    const events: string[] = [];
    for (const type of ["input", "change"]) area.addEventListener(type, () => events.push(type));
    area.focus();
    area.textarea.select();
    await userEvent.keyboard("yo");
    expect(area.value).toBe("yo");
    expect(new FormData(form).get("m")).toBe("yo");
    expect(area.validity.tooShort).toBe(true);
    area.blur();
    expect(events).toEqual(["input", "input", "change"]);

    area.value = "";
    expect(area.validity.valueMissing).toBe(true);
    expect(area.checkValidity()).toBe(false);
    form.reset();
    expect(area.value).toBe("hi");
    expect(area.checkValidity()).toBe(true);

    host.querySelector("fieldset")!.disabled = true;
    expect(area.disabled).toBe(true);
    expect(area.textarea.disabled).toBe(true);
    expect(new FormData(form).has("m")).toBe(false);
  });
});

describe("ui-native-select", () => {
  const options = `<option value="a">Alpha</option><optgroup label="More">
    <option value="b">Beta</option><option value="c" disabled>Gamma</option></optgroup>`;

  it("builds options from children, picks with the keyboard and submits", async () => {
    const host = mount(`<form><label for="s">Pick</label>
      <ui-native-select id="s" name="s">${options}</ui-native-select></form>`);
    await frame();
    const form = host.querySelector("form")!;
    const select = host.querySelector<UiNativeSelect>("ui-native-select")!;
    expect(await ax("combobox", "Pick")).toBeTruthy();
    expect(select.select.querySelectorAll("optgroup").length).toBe(1);
    expect(select.value).toBe("a");
    expect(new FormData(form).get("s")).toBe("a");
    const changes = vi.fn();
    select.addEventListener("change", changes);
    select.focus();
    await userEvent.selectOptions(select.select, "b");
    expect(select.value).toBe("b");
    expect(new FormData(form).get("s")).toBe("b");
    expect(changes).toHaveBeenCalledTimes(1);
    form.reset();
    expect(select.value).toBe("a");
  });

  it("supports a placeholder, required, the options property and value attribute", async () => {
    const host = mount(`<form><ui-native-select name="s" placeholder="Choose..." required
      aria-label="Plan"></ui-native-select></form>`);
    const select = host.querySelector<UiNativeSelect>("ui-native-select")!;
    select.options = [
      { value: "free", label: "Free" },
      { label: "Paid", options: [{ value: "pro", label: "Pro" }] },
    ];
    expect(select.value).toBe("");
    expect(select.validity.valueMissing).toBe(true);
    expect(select.select.selectedOptions[0]?.textContent).toBe("Choose...");
    select.value = "pro";
    expect(select.checkValidity()).toBe(true);
    expect(new FormData(host.querySelector("form")!).get("s")).toBe("pro");
    host.querySelector("form")!.reset();
    expect(select.value).toBe("");
    select.setAttribute("value", "free");
    expect(select.value).toBe("free");
    expect(select.select.selectedOptions[0]?.textContent).toBe("Free");
  });
});
