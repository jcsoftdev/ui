import axe from "axe-core";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { defineDataGrid, type GridColumn, type UiDataGrid } from "../src/data-grid/data-grid.ts";
import { frame, mount } from "./setup.ts";

beforeAll(() => {
  defineDataGrid();
});

afterEach(() => {
  document.body.innerHTML = "";
});

interface Person {
  id: string;
  name: string;
  age: number | null;
  city: string;
  active: boolean;
  born: Date | null;
}

const people = (n = 10): Person[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    name: `Person ${i}`,
    age: 20 + i,
    city: ["Lima", "Cusco", "Piura"][i % 3] as string,
    active: i % 2 === 0,
    born: new Date(1990 + i, 0, 15),
  }));

const columns = (): GridColumn<Person>[] => [
  { id: "name", header: "Name", width: 160, editable: true },
  { id: "age", header: "Age", type: "number", width: 100, editable: true },
  { id: "city", header: "City", width: 120, editable: true, options: ["Lima", "Cusco", "Piura"] },
  { id: "active", header: "Active", type: "boolean", width: 90, editable: true },
  { id: "born", header: "Born", type: "date", width: 130, editable: true },
  { id: "readonly", header: "Locked", width: 100, accessor: () => "fixed" },
];

const grid = async (
  attrs = "",
  setup?: (el: UiDataGrid) => void,
  rows: Person[] = people(),
): Promise<UiDataGrid> => {
  const host = mount(
    `<div style="width:800px"><ui-data-grid label="People" style="--ui-data-grid-height:320px" ${attrs}></ui-data-grid></div>`,
  );
  const el = host.querySelector("ui-data-grid") as UiDataGrid;
  if (setup) setup(el);
  else {
    el.columns = columns();
    el.rows = rows;
    el.rowKey = "id";
  }
  await frame();
  await frame();
  // The editor chunk loads after the first render: wait for the hooks to be in.
  await new Promise((resolve) => setTimeout(resolve, 60));
  return el;
};

const cell = (el: UiDataGrid, key: string, col: string) =>
  el.getCellElement(key, col) as HTMLElement;
const editor = (el: Element) => el.querySelector<HTMLElement>("[data-ui-part=editor]");
const input = (el: Element) => editor(el) as HTMLInputElement;
const editorOpen = (el: Element) => vi.waitFor(() => expect(editor(el)).toBeTruthy());
const editorClosed = (el: Element) => vi.waitFor(() => expect(editor(el)).toBeNull());
const active = () => document.activeElement as HTMLElement;
const events = (el: Element, type: string) => {
  const seen: Array<Record<string, unknown>> = [];
  el.addEventListener(type, (event) => seen.push((event as CustomEvent).detail));
  return seen;
};
const editChunk = () =>
  performance
    .getEntriesByType("resource")
    .some((entry) => /data-grid\/edit(\.|\?|$)/.test(entry.name));
const violations = async (root: Element) =>
  (
    await axe.run(root, {
      rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
    })
  ).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);

/** Focuses a cell and starts editing it with Enter. */
const open = async (el: UiDataGrid, key: string, col: string) => {
  el.focusCell(key, col);
  await vi.waitFor(() => expect(active()).toBe(cell(el, key, col)));
  await userEvent.keyboard("{Enter}");
  await editorOpen(el);
};

describe("ui-data-grid editing", () => {
  // First on purpose: the editor module must not have been fetched by anything before it.
  it("a read-only grid never fetches the editor; an editable one does without any edit", async () => {
    const readOnly = await grid("", (el) => {
      el.columns = [{ id: "name", header: "Name" }];
      el.rows = people(3);
      el.rowKey = "id";
    });
    el_focus(readOnly);
    await userEvent.keyboard("x{Enter}");
    expect(editChunk()).toBe(false);
    expect(editor(readOnly)).toBeNull();
    document.body.innerHTML = "";

    await grid('editable locale="en"', (el) => {
      el.columns = [{ id: "name", header: "Name" }];
      el.rows = people(3);
      el.rowKey = "id";
    });
    await vi.waitFor(() => expect(editChunk()).toBe(true));
  });

  it("Enter opens a text editor on the cell, labelled by the column; Enter commits and moves down", async () => {
    const el = await grid();
    const changes = events(el, "cellchange");
    await open(el, "p1", "name");
    expect(input(el).value).toBe("Person 1");
    expect(input(el).getAttribute("aria-label")).toBe("Name");
    expect(cell(el, "p1", "name").contains(input(el))).toBe(true);
    expect(active()).toBe(input(el));
    await userEvent.keyboard("Ana{Enter}");
    await editorClosed(el);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      rowKey: "p1",
      columnId: "name",
      oldValue: "Person 1",
      newValue: "Ana",
    });
    expect((changes[0]?.row as Person | undefined)?.name).toBe("Ana");
    expect(cell(el, "p1", "name").textContent).toBe("Ana");
    await vi.waitFor(() => expect(active()).toBe(cell(el, "p2", "name")));
  });

  it("Shift+Enter commits and moves up", async () => {
    const el = await grid();
    await open(el, "p2", "name");
    await userEvent.keyboard("Zed{Shift>}{Enter}{/Shift}");
    await editorClosed(el);
    expect(cell(el, "p2", "name").textContent).toBe("Zed");
    await vi.waitFor(() => expect(active()).toBe(cell(el, "p1", "name")));
  });

  it("Escape cancels, restores the old value and returns focus to the cell", async () => {
    const el = await grid();
    const changes = events(el, "cellchange");
    await open(el, "p0", "name");
    await userEvent.keyboard("typed junk{Escape}");
    await editorClosed(el);
    expect(changes).toEqual([]);
    expect(cell(el, "p0", "name").textContent).toBe("Person 0");
    expect(active()).toBe(cell(el, "p0", "name"));
  });

  it("Tab commits and opens the next editable cell, skipping read-only ones; Shift+Tab goes back", async () => {
    const el = await grid();
    await open(el, "p0", "name");
    await userEvent.keyboard("A{Tab}");
    await vi.waitFor(() => expect(cell(el, "p0", "age").contains(editor(el))).toBe(true));
    expect(cell(el, "p0", "name").textContent).toBe("A");
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    await vi.waitFor(() => expect(cell(el, "p0", "name").contains(editor(el))).toBe(true));
    // Past the last editable column of a row it wraps to the next row; the locked column is skipped.
    await userEvent.keyboard("{Escape}");
    await open(el, "p0", "born");
    await userEvent.keyboard("{Tab}");
    await vi.waitFor(() => expect(cell(el, "p1", "name").contains(editor(el))).toBe(true));
  });

  it("clicking outside commits", async () => {
    const el = await grid();
    const changes = events(el, "cellchange");
    await open(el, "p0", "name");
    await userEvent.keyboard("Outside");
    await userEvent.click(document.body);
    await editorClosed(el);
    expect(changes).toHaveLength(1);
    expect(cell(el, "p0", "name").textContent).toBe("Outside");
    // The click landed on nothing: focus comes back to the edited cell.
    expect(active()).toBe(cell(el, "p0", "name"));
  });

  it("clicking another cell commits and leaves focus on the clicked cell", async () => {
    const el = await grid();
    await open(el, "p0", "name");
    await userEvent.keyboard("Moved");
    await userEvent.click(cell(el, "p3", "city"));
    await editorClosed(el);
    expect(cell(el, "p0", "name").textContent).toBe("Moved");
    expect(active()).toBe(cell(el, "p3", "city"));
  });

  it("a printable key starts editing seeded with it; beforecelledit carries the trigger", async () => {
    const el = await grid();
    const before = events(el, "beforecelledit");
    el.focusCell("p0", "name");
    await vi.waitFor(() => expect(active()).toBe(cell(el, "p0", "name")));
    await userEvent.keyboard("q");
    await editorOpen(el);
    expect(input(el).value).toBe("q");
    expect(input(el).selectionStart).toBe(1);
    expect(before.at(-1)).toMatchObject({ trigger: "type", rowKey: "p0", columnId: "name" });
    await userEvent.keyboard("{Escape}");
    await userEvent.keyboard("{Enter}");
    await editorOpen(el);
    expect(input(el).value).toBe("Person 0");
    expect(before.at(-1)).toMatchObject({ trigger: "enter" });
    await userEvent.keyboard("{Escape}{F2}");
    await editorOpen(el);
    expect(before.at(-1)).toMatchObject({ trigger: "f2" });
    await userEvent.keyboard("{Escape}");
    await editorClosed(el);
    await userEvent.dblClick(cell(el, "p0", "name"));
    await editorOpen(el);
    expect(before.at(-1)).toMatchObject({ trigger: "dblclick" });
  });

  it("typing on a read-only cell, or with Ctrl, does not edit; Space still toggles selection", async () => {
    const el = await grid('selection="multi"');
    el.focusCell("p0", "readonly");
    await vi.waitFor(() => expect(active()).toBe(cell(el, "p0", "readonly")));
    await userEvent.keyboard("x");
    expect(editor(el)).toBeNull();
    el.focusCell("p0", "name");
    await vi.waitFor(() => expect(active()).toBe(cell(el, "p0", "name")));
    await userEvent.keyboard("{Control>}c{/Control}");
    expect(editor(el)).toBeNull();
    await userEvent.keyboard(" ");
    expect(editor(el)).toBeNull();
    expect(el.selectedKeys).toEqual(["p0"]);
  });

  it("a cancelled beforecelledit leaves the cell alone", async () => {
    const el = await grid();
    el.addEventListener("beforecelledit", (event) => event.preventDefault());
    el.focusCell("p0", "name");
    await vi.waitFor(() => expect(active()).toBe(cell(el, "p0", "name")));
    await userEvent.keyboard("{Enter}");
    await frame();
    expect(editor(el)).toBeNull();
  });

  it("editable per column and per row: false and functions are honoured", async () => {
    const el = await grid("editable", (g) => {
      g.columns = [
        { id: "name", header: "Name" },
        { id: "age", header: "Age", editable: false },
        { id: "city", header: "City", editable: (row: Person) => row.id === "p1" },
      ];
      g.rows = people(3);
      g.rowKey = "id";
    });
    expect(await el.editCell("p0", "name")).toBe(true);
    await userEvent.keyboard("{Escape}");
    await editorClosed(el);
    expect(await el.editCell("p0", "age")).toBe(false);
    expect(await el.editCell("p0", "city")).toBe(false);
    expect(await el.editCell("p1", "city")).toBe(true);
    expect(editor(el)?.tagName).toBe("INPUT");
  });

  describe("writing values", () => {
    it("setter writes a function accessor; parse turns the text into the value", async () => {
      const rows = [{ id: "a", first: "Ana", last: "Paz" }];
      const el = await grid("", (g) => {
        g.columns = [
          {
            id: "full",
            header: "Full name",
            editable: true,
            accessor: (row: (typeof rows)[0]) => `${row.first} ${row.last}`,
            parse: (text: string) => text.trim().toUpperCase(),
            setter: (row: (typeof rows)[0], value) => {
              const [first, ...rest] = String(value).split(" ");
              row.first = first as string;
              row.last = rest.join(" ");
            },
          },
        ];
        g.rows = rows;
        g.rowKey = "id";
      });
      await open(el, "a", "full");
      expect(input(el).value).toBe("Ana Paz");
      await userEvent.keyboard("  luz vega {Enter}");
      await editorClosed(el);
      expect(rows[0]).toMatchObject({ first: "LUZ", last: "VEGA" });
      expect(cell(el, "a", "full").textContent).toBe("LUZ VEGA");
    });

    it('edit-mode="emit" emits cellchange and never touches the row (frozen data works)', async () => {
      const rows = people(2).map((row) => Object.freeze(row));
      const el = await grid('edit-mode="emit"', undefined, rows);
      const changes = events(el, "cellchange");
      await open(el, "p0", "name");
      await userEvent.keyboard("Immutable{Enter}");
      await editorClosed(el);
      expect(changes).toHaveLength(1);
      expect(changes[0]).toMatchObject({ oldValue: "Person 0", newValue: "Immutable" });
      expect(rows[0]?.name).toBe("Person 0");
      // The consumer applies the change by giving the grid new rows.
      el.rows = rows.map((row) => (row.id === "p0" ? { ...row, name: "Immutable" } : row));
      await vi.waitFor(() => expect(cell(el, "p0", "name").textContent).toBe("Immutable"));
    });

    it("an unchanged value fires no event; a cancelled beforecellchange discards the edit", async () => {
      const el = await grid();
      const changes = events(el, "cellchange");
      await open(el, "p0", "name");
      await userEvent.keyboard("{Enter}");
      await editorClosed(el);
      expect(changes).toEqual([]);
      el.addEventListener("beforecellchange", (event) => event.preventDefault());
      await open(el, "p0", "name");
      await userEvent.keyboard("X{Enter}");
      await editorClosed(el);
      expect(changes).toEqual([]);
      expect(cell(el, "p0", "name").textContent).toBe("Person 0");
    });
  });

  describe("validation", () => {
    const validated = () =>
      grid("", (g) => {
        g.columns = [
          {
            id: "name",
            header: "Name",
            editable: true,
            validate: (value) => (String(value).length < 3 ? "Use at least 3 letters" : null),
          },
        ];
        g.rows = people(3);
        g.rowKey = "id";
      });

    it("an error keeps the editor open, is invalid and described, and clears when the user types", async () => {
      const el = await validated();
      const changes = events(el, "cellchange");
      await open(el, "p0", "name");
      await userEvent.keyboard("ab{Enter}");
      await vi.waitFor(() => expect(input(el).getAttribute("aria-invalid")).toBe("true"));
      const message = document.getElementById(input(el).getAttribute("aria-describedby") ?? "");
      await vi.waitFor(() => expect(message?.textContent).toBe("Use at least 3 letters"));
      expect(message?.getAttribute("role")).toBe("alert");
      expect(changes).toEqual([]);
      expect(active()).toBe(input(el));
      await userEvent.keyboard("c");
      await vi.waitFor(() => expect(input(el).hasAttribute("aria-invalid")).toBe(false));
      expect(el.querySelector("[data-ui-part=edit-error]")).toBeNull();
      await userEvent.keyboard("{Enter}");
      await editorClosed(el);
      expect(changes).toHaveLength(1);
      expect(cell(el, "p0", "name").textContent).toBe("abc");
    });

    it("an error survives a click outside (the editor stays open) and Escape still restores", async () => {
      const el = await validated();
      await open(el, "p0", "name");
      await userEvent.keyboard("x");
      await userEvent.click(document.body);
      await vi.waitFor(() => expect(input(el)?.getAttribute("aria-invalid")).toBe("true"));
      input(el).focus();
      await userEvent.keyboard("{Escape}");
      await editorClosed(el);
      expect(cell(el, "p0", "name").textContent).toBe("Person 0");
    });

    it("async validation: the cell is busy meanwhile, then it commits or refuses", async () => {
      let release: (message: string | null) => void = () => {};
      const el = await grid("", (g) => {
        g.columns = [
          {
            id: "name",
            header: "Name",
            editable: true,
            validate: () => new Promise<string | null>((resolve) => (release = resolve)),
          },
        ];
        g.rows = people(2);
        g.rowKey = "id";
      });
      await open(el, "p0", "name");
      await userEvent.keyboard("A{Enter}");
      await vi.waitFor(() => expect(cell(el, "p0", "name").getAttribute("aria-busy")).toBe("true"));
      // Pressing Enter again while it is pending does nothing.
      await userEvent.keyboard("{Enter}");
      release("Taken");
      await vi.waitFor(() => expect(input(el).getAttribute("aria-invalid")).toBe("true"));
      expect(cell(el, "p0", "name").hasAttribute("aria-busy")).toBe(false);
      await userEvent.keyboard("{Enter}");
      release(null);
      await editorClosed(el);
      expect(cell(el, "p0", "name").textContent).toBe("A");
    });

    it("passes axe with an editor open and with its error showing", async () => {
      const el = await validated();
      await open(el, "p0", "name");
      expect(await violations(document.body)).toEqual([]);
      await userEvent.keyboard("x{Enter}");
      await vi.waitFor(() => expect(input(el).getAttribute("aria-invalid")).toBe("true"));
      await vi.waitFor(() =>
        expect(document.querySelector("[data-ui-part=edit-error]")?.textContent).toBeTruthy(),
      );
      expect(await violations(document.body)).toEqual([]);
    });
  });

  describe("built-in editors", () => {
    it("number: parses with the grid's locale, rejects text, stores null when emptied", async () => {
      const el = await grid('locale="de-DE"');
      const changes = events(el, "cellchange");
      await open(el, "p0", "age");
      expect(input(el).inputMode).toBe("decimal");
      expect(input(el).value).toBe("20");
      await userEvent.keyboard("1.234,5{Enter}");
      await editorClosed(el);
      expect(changes.at(-1)).toMatchObject({ columnId: "age", newValue: 1234.5 });
      await open(el, "p1", "age");
      await userEvent.keyboard("abc{Enter}");
      await vi.waitFor(() => expect(input(el).getAttribute("aria-invalid")).toBe("true"));
      await vi.waitFor(() =>
        expect(document.querySelector("[data-ui-part=edit-error]")?.textContent).toBe(
          "Enter a valid number",
        ),
      );
      input(el).select();
      await userEvent.keyboard("{Backspace}{Enter}");
      await editorClosed(el);
      expect(changes.at(-1)).toMatchObject({ rowKey: "p1", newValue: null });
    });

    it("number follows another locale", async () => {
      const el = await grid('locale="en-US"');
      await open(el, "p0", "age");
      await userEvent.keyboard("1,234.5{Enter}");
      await editorClosed(el);
      expect((el.rows as Person[])[0]?.age).toBe(1234.5);
    });

    it("date: reads the locale's day order and rejects impossible dates", async () => {
      const el = await grid('locale="es-PE"');
      await open(el, "p0", "born");
      expect(input(el).placeholder).toBe("dd/mm/yyyy");
      expect(input(el).value).toBe("15/01/1990");
      await userEvent.keyboard("31/02/2024{Enter}");
      await vi.waitFor(() => expect(input(el).getAttribute("aria-invalid")).toBe("true"));
      input(el).select();
      await userEvent.keyboard("29/02/2024{Enter}");
      await editorClosed(el);
      expect((el.rows as Person[])[0]?.born).toEqual(new Date(2024, 1, 29));
      const us = await grid('locale="en-US"');
      await open(us, "p0", "born");
      expect(input(us).value).toBe("01/15/1990");
    });

    it("select: lists the options, preselects the value and stores the choice", async () => {
      const el = await grid();
      await open(el, "p0", "city");
      const select = editor(el) as HTMLSelectElement;
      expect(select.tagName).toBe("SELECT");
      expect([...select.options].map((o) => o.text)).toEqual(["Lima", "Cusco", "Piura"]);
      expect(select.selectedOptions[0]?.text).toBe("Lima");
      select.selectedIndex = 2;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      await userEvent.keyboard("{Enter}");
      await editorClosed(el);
      expect((el.rows as Person[])[0]?.city).toBe("Piura");
    });

    it("select takes {value, label} options and keeps their value type", async () => {
      const rows = [{ id: "a", level: 2 }];
      const el = await grid("", (g) => {
        g.columns = [
          {
            id: "level",
            header: "Level",
            editable: true,
            options: [
              { value: 1, label: "Low" },
              { value: 2, label: "Mid" },
              { value: 3, label: "High" },
            ],
          },
        ];
        g.rows = rows;
        g.rowKey = "id";
      });
      await open(el, "a", "level");
      const select = editor(el) as HTMLSelectElement;
      expect(select.selectedOptions[0]?.text).toBe("Mid");
      await userEvent.keyboard("H");
      await userEvent.keyboard("{Enter}");
      await editorClosed(el);
      expect(rows[0]?.level).toBe(3);
    });

    it("boolean: a checkbox that Space toggles", async () => {
      const el = await grid();
      await open(el, "p0", "active");
      const box = input(el);
      expect(box.type).toBe("checkbox");
      expect(box.checked).toBe(true);
      await userEvent.keyboard(" {Enter}");
      await editorClosed(el);
      expect((el.rows as Person[])[0]?.active).toBe(false);
    });

    it("every built-in editor passes axe while open", async () => {
      const el = await grid();
      for (const col of ["name", "age", "city", "active", "born"]) {
        await open(el, "p0", col);
        expect(await violations(document.body), col).toEqual([]);
        await userEvent.keyboard("{Escape}");
        await editorClosed(el);
      }
    });
  });

  describe("custom editors", () => {
    it("a factory returns an element and a value() read on commit; it gets the seed and row", async () => {
      let context: { seed?: string; value?: unknown; locale?: string } = {};
      const el = await grid("", (g) => {
        g.columns = [
          {
            id: "name",
            header: "Name",
            editable: true,
            editor: (ctx) => {
              context = ctx;
              const field = document.createElement("input");
              field.value = String(ctx.value);
              field.dataset.uiPart = "editor";
              field.setAttribute("aria-label", "Custom");
              return { element: field, value: () => `<${field.value}>` };
            },
          },
        ];
        g.rows = people(2);
        g.rowKey = "id";
      });
      el.focusCell("p0", "name");
      await vi.waitFor(() => expect(active()).toBe(cell(el, "p0", "name")));
      await userEvent.keyboard("z");
      await editorOpen(el);
      expect(context.seed).toBe("z");
      expect(context.value).toBe("Person 0");
      expect(context.locale).toBeTruthy();
      await userEvent.keyboard("{Enter}");
      await editorClosed(el);
      expect((el.rows as Person[])[0]?.name).toBe("<Person 0>");
    });

    it("a custom element tag gets value/row/column and can commit or cancel by event", async () => {
      class Rating extends HTMLElement {
        value: unknown = 0;
        row: unknown;
        connectedCallback() {
          this.tabIndex = 0;
          this.dataset.uiPart = "editor";
          this.setAttribute("aria-label", "Rating");
          this.textContent = String(this.value);
          this.addEventListener("keydown", (event) => {
            if (event.key === "ArrowUp") {
              this.value = Number(this.value) + 1;
              this.textContent = String(this.value);
              event.stopPropagation();
            }
            if (event.key === "s") {
              event.stopPropagation();
              this.dispatchEvent(new CustomEvent("commit"));
            }
          });
        }
      }
      customElements.define("x-rating", Rating);
      const el = await grid("", (g) => {
        g.columns = [{ id: "age", header: "Age", editable: true, editor: "x-rating" }];
        g.rows = people(2);
        g.rowKey = "id";
      });
      await open(el, "p0", "age");
      const rating = editor(el) as Rating;
      expect(rating.localName).toBe("x-rating");
      expect(rating.value).toBe(20);
      expect((rating.row as Person).id).toBe("p0");
      await userEvent.keyboard("{ArrowUp}{ArrowUp}s");
      await editorClosed(el);
      expect((el.rows as Person[])[0]?.age).toBe(22);
      expect(active()).toBe(cell(el, "p0", "age"));
    });
  });

  it("keeps the edited cell while the grid re-renders around it", async () => {
    const el = await grid();
    await open(el, "p0", "name");
    await userEvent.keyboard("Keep");
    el.refresh();
    await frame();
    await frame();
    expect(input(el).value).toBe("Keep");
    await userEvent.keyboard("{Enter}");
    await editorClosed(el);
    expect(cell(el, "p0", "name").textContent).toBe("Keep");
  });
});

function el_focus(grid: UiDataGrid) {
  grid.focusCell("p0", "name");
}
