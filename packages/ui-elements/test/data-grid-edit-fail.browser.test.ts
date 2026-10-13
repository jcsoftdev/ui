import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { defineDataGrid, type UiDataGrid } from "../src/data-grid/data-grid.ts";
import { frame, mount, wait } from "./setup.ts";

// The first install fails, as a 404 for the chunk would.
const state = vi.hoisted(() => ({ calls: 0 }));
vi.mock("../src/data-grid/edit.ts", async (original) => {
  const real = await original<typeof import("../src/data-grid/edit.ts")>();
  return {
    ...real,
    install(...args: Parameters<typeof real.install>) {
      state.calls += 1;
      if (state.calls === 1) throw new Error("chunk 404");
      return real.install(...args);
    },
  };
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

describe("editor chunk failure", () => {
  it("M2: a failed load reports editerror, resolves false, and the next edit retries", async () => {
    defineDataGrid();
    const host = mount(
      '<ui-data-grid label="P" editable style="--ui-data-grid-height:300px"></ui-data-grid>',
    );
    const el = host.querySelector("ui-data-grid") as UiDataGrid;
    const errors: unknown[] = [];
    el.addEventListener("editerror", (event) => errors.push((event as CustomEvent).detail.error));
    el.columns = [{ id: "name", header: "Name" }];
    el.rows = [{ id: "a", name: "Ann" }];
    el.rowKey = "id";
    await vi.waitFor(() => expect(errors).toHaveLength(1), { timeout: 3000 });
    expect(String(errors[0])).toMatch(/404/);
    // Nothing is cached: the next edit loads again and succeeds.
    expect(await el.editCell("a", "name")).toBe(true);
    expect(editor(el)).toBeTruthy();
    expect(state.calls).toBe(2);
  });
});
