import { afterEach, describe, expect, it, vi } from "vitest";
import { defineElement } from "../src/internal/base.ts";
import { FormElement } from "../src/internal/form.ts";
import { mount } from "./setup.ts";

/** The smallest FormElement: a value picked by `pick()`, rendered into `data-value`. */
class TestField extends FormElement {
  renders = 0;
  pick(value: string) {
    this.commit(value);
  }
  protected render(): void {
    this.renders++;
    this.dataset.value = this.value;
  }
}
defineElement("test-field", TestField, { prefix: "x" });

afterEach(() => {
  document.body.innerHTML = "";
});

describe("FormElement", () => {
  it("submits, validates required, resets to the attribute and follows a disabled fieldset", () => {
    const host = mount(`<form><fieldset><x-test-field name="size" value="m" required></x-test-field>
      </fieldset></form>`);
    const form = host.querySelector("form")!;
    const field = host.querySelector<TestField>("x-test-field")!;
    expect(new FormData(form).get("size")).toBe("m");
    expect(field.checkValidity()).toBe(true);
    const events = vi.fn();
    field.addEventListener("change", events);
    field.pick("");
    expect(events).toHaveBeenCalledTimes(1);
    expect(field.validity.valueMissing).toBe(true);
    expect(new FormData(form).has("size")).toBe(false);
    field.pick("l");
    expect(field.dataset.value).toBe("l");
    form.reset();
    expect(field.value).toBe("m");
    host.querySelector("fieldset")!.disabled = true;
    expect(field.disabled).toBe(true);
    field.pick("s");
    expect(field.value).toBe("m");
    expect(new FormData(form).has("size")).toBe(false);
  });
});
