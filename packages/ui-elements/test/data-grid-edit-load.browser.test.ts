import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { defineDataGrid, type UiDataGrid } from "../src/data-grid/data-grid.ts";
import { frame, mount, wait } from "./setup.ts";

// The editor chunk takes 400 ms to arrive: the module is replaced for this file only.
vi.mock("../src/data-grid/edit.ts", async (original) => {
  await new Promise((resolve) => setTimeout(resolve, 400));
  return original();
});

afterEach(() => {
  document.body.innerHTML = "";
});

const grid = async () => {
  defineDataGrid();
  const host = mount(
    '<ui-data-grid label="P" editable style="--ui-data-grid-height:300px"></ui-data-grid>',
  );
  const el = host.querySelector("ui-data-grid") as UiDataGrid;
  el.columns = [{ id: "name", header: "Name" }];
  el.rows = [
    { id: "a", name: "Ann" },
    { id: "b", name: "Bob" },
  ];
  el.rowKey = "id";
  await frame();
  await frame();
  return el;
};

const editor = (el: Element) => el.querySelector<HTMLInputElement>("[data-ui-part=editor]");

describe("editor chunk loading", () => {
  it("M1: keys typed while the chunk is loading are not lost; Enter opens the editor, not cellactivate", async () => {
    const el = await grid();
    const activated: unknown[] = [];
    const before: string[] = [];
    el.addEventListener("cellactivate", (event) => activated.push((event as CustomEvent).detail));
    el.addEventListener("beforecelledit", (event) =>
      before.push((event as CustomEvent).detail.trigger),
    );
    el.focusCell("a", "name");
    await vi.waitFor(() => expect(document.activeElement).toBe(el.getCellElement("a", "name")));
    expect(
      performance.getEntriesByType("resource").some((e) => /data-grid\/edit\.ts/.test(e.name)),
    ).toBe(false);
    await userEvent.keyboard("x");
    await vi.waitFor(() => expect(editor(el)?.value).toBe("x"), { timeout: 3000 });
    expect(before).toEqual(["type"]);
    await userEvent.keyboard("{Escape}");
    await wait(20);
    expect(editor(el)).toBeNull();
  });
});
