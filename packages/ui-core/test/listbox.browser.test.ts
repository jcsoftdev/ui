import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { createListbox } from "../src/listbox.ts";

function mount(html: string): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.append(host);
  return host;
}
afterEach(() => {
  document.body.innerHTML = "";
});

const LIST = `
  <input id="input" />
  <div id="list">
    <div role="group" id="g1"><div role="option" data-value="apple">Apple</div><div role="option" data-value="apricot" data-keywords="fruit">Apricot</div></div>
    <div role="group" id="g2"><div role="option" data-value="banana">Banana</div><div role="option" data-value="cherry" aria-disabled="true">Cherry</div></div>
  </div>`;

const el = (host: HTMLElement, selector: string) => host.querySelector(selector) as HTMLElement;

describe("createListbox", () => {
  it("drives aria-activedescendant from the controller and selects with Enter", async () => {
    const host = mount(LIST);
    const input = el(host, "#input");
    const onValueChange = vi.fn();
    const box = createListbox(el(host, "#list"), { controller: input, onValueChange });
    expect(el(host, "#list").getAttribute("role")).toBe("listbox");
    input.focus();
    expect(input.getAttribute("aria-activedescendant")).toBe(box.active?.id);
    await userEvent.keyboard("{ArrowDown}");
    expect(box.active?.dataset.value).toBe("apricot");
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(box.active?.dataset.value).toBe("banana");
    await userEvent.keyboard("{Enter}");
    expect(onValueChange).toHaveBeenLastCalledWith(["banana"]);
    expect(box.active?.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(input);
  });

  it("filters, hides empty groups and re-targets the active option", () => {
    const host = mount(LIST);
    const box = createListbox(el(host, "#list"), {});
    box.setSearch("ban");
    expect(box.count).toBe(1);
    expect(el(host, "#g1").hidden).toBe(true);
    expect(el(host, "#g2").hidden).toBe(false);
    expect(box.active?.dataset.value).toBe("banana");
    box.setSearch("fruit");
    expect(box.options().map((o) => o.dataset.value)).toEqual(["apricot"]);
    box.setSearch("");
    expect(box.count).toBe(4);
  });

  it("supports multiple selection, shift ranges and select-all", async () => {
    const host = mount(LIST);
    const input = el(host, "#input");
    const box = createListbox(el(host, "#list"), { controller: input, multiple: true });
    input.focus();
    await userEvent.keyboard("{Enter}");
    expect(box.value).toEqual(["apple"]);
    await userEvent.keyboard("{Enter}");
    expect(box.value).toEqual([]);
    await userEvent.keyboard("{Shift>}{ArrowDown}{ArrowDown}{/Shift}");
    expect(box.value).toEqual(["apple", "apricot", "banana"]);
    expect(el(host, "#list").getAttribute("aria-multiselectable")).toBe("true");
  });

  it("reorders visible options by score when sorting", () => {
    const host = mount(`<div id="list">
      <div role="option" data-value="xaz">xaz</div>
      <div role="option" data-value="az">az</div></div>`);
    const box = createListbox(el(host, "#list"), {
      sort: true,
      filter: (value, search) => (value.startsWith(search) ? 1 : value.includes(search) ? 0.5 : 0),
    });
    box.setSearch("a");
    expect(Array.from(host.querySelectorAll("[role=option]")).map((o) => o.textContent)).toEqual([
      "az",
      "xaz",
    ]);
    box.setSearch("");
    expect(Array.from(host.querySelectorAll("[role=option]")).map((o) => o.textContent)).toEqual([
      "xaz",
      "az",
    ]);
  });

  it("moves DOM focus in focus mode and supports typeahead", async () => {
    const host = mount(LIST);
    const box = createListbox(el(host, "#list"), { focusMode: "focus" });
    box.setActive("apple");
    expect(document.activeElement).toBe(box.active);
    await userEvent.keyboard("b");
    expect(box.active?.dataset.value).toBe("banana");
  });

  it("ignores disabled options when clicking", async () => {
    const host = mount(LIST);
    const onChoose = vi.fn();
    createListbox(el(host, "#list"), { onChoose });
    el(host, '[data-value="cherry"]').click();
    expect(onChoose).not.toHaveBeenCalled();
    el(host, '[data-value="apple"]').click();
    expect(onChoose).toHaveBeenCalledTimes(1);
  });
});
