import { describe, expect, it } from "vitest";
import {
  datePlaceholder,
  draftText,
  editorKind,
  formatDateDraft,
  normalizeOptions,
  parseDate,
  parseDraft,
  parseNumber,
  sameValue,
  validateValue,
} from "../src/grid/edit.ts";
import type { GridColumn } from "../src/grid/model.ts";

const col = (extra: Partial<GridColumn<{ n: number }>> = {}): GridColumn<{ n: number }> => ({
  id: "n",
  header: "N",
  ...extra,
});

describe("editorKind", () => {
  it("prefers the explicit editor, then options, then the type", () => {
    expect(editorKind(col({ editor: "date" }))).toBe("date");
    expect(editorKind(col({ options: ["a"], type: "number" }))).toBe("select");
    expect(editorKind(col({ type: "currency" }))).toBe("number");
    expect(editorKind(col({ type: "boolean" }))).toBe("boolean");
    expect(editorKind(col({ type: "date" }))).toBe("date");
    expect(editorKind(col())).toBe("text");
    expect(editorKind(col({ editor: "x-picker" }))).toBe("custom");
    expect(
      editorKind(col({ editor: () => ({ element: document.createElement("i"), value: () => 1 }) })),
    ).toBe("custom");
  });
});

describe("parseNumber follows the locale", () => {
  it.each([
    ["1,234.5", "es-PE", 1234.5],
    ["1 234.5", "es-PE", 1234.5],
    ["1.234,5", "de-DE", 1234.5],
    ["1.234,5", "es-ES", 1234.5],
    ["1 234,5", "fr-FR", 1234.5],
    ["-3", "en", -3],
    [".5", "en", 0.5],
    ["12,5", "en", 12.5],
    ["1,234", "en", 1234],
    ["1.5", "de-DE", 1.5],
    ["1.234", "de-DE", 1234],
  ])("%s in %s", (text, locale, expected) => {
    expect(parseNumber(text, locale)).toBe(expected);
  });

  it.each(["abc", "1.2.3", "--1", "", "1e5", "S/ 10"])("rejects %j", (text) => {
    expect(parseNumber(text, "en")).toBeNull();
  });
});

describe("dates", () => {
  it("reads the locale's order and ISO", () => {
    expect(parseDate("22/11/2000", "es-PE")).toEqual(new Date(2000, 10, 22));
    expect(parseDate("11/22/2000", "en-US")).toEqual(new Date(2000, 10, 22));
    expect(parseDate("2000-11-22", "en-US")).toEqual(new Date(2000, 10, 22));
    expect(parseDate("22.11.2000", "de-DE")).toEqual(new Date(2000, 10, 22));
    expect(parseDate("1/2/24", "es-PE")).toEqual(new Date(2024, 1, 1));
  });

  it("rejects impossible dates and text", () => {
    expect(parseDate("31/02/2024", "es-PE")).toBeNull();
    expect(parseDate("13/13/2024", "en-US")).toBeNull();
    expect(parseDate("tomorrow", "en")).toBeNull();
    expect(parseDate("1/2", "en")).toBeNull();
  });

  it("round-trips through the draft text and shows a placeholder", () => {
    for (const locale of ["es-PE", "en-US", "de-DE", "ja-JP"]) {
      const date = new Date(2024, 1, 29);
      expect(parseDate(formatDateDraft(date, locale), locale)).toEqual(date);
    }
    expect(datePlaceholder("es-PE")).toBe("dd/mm/yyyy");
    expect(datePlaceholder("en-US")).toBe("mm/dd/yyyy");
  });
});

describe("parseDraft", () => {
  const row = { n: 1 };
  it("uses the built-in per kind and stores null for empty numbers and dates", () => {
    expect(parseDraft(col(), "number", "1,5", row, "de-DE")).toEqual({ value: 1.5 });
    expect(parseDraft(col(), "number", "", row, "en")).toEqual({ value: null });
    expect(parseDraft(col(), "number", "x", row, "en")).toEqual({ error: "number" });
    expect(parseDraft(col(), "date", "x", row, "en")).toEqual({ error: "date" });
    expect(parseDraft(col(), "text", "", row, "en")).toEqual({ value: "" });
  });

  it("lets column.parse win and reject", () => {
    const parse = (text: string) => (text === "?" ? { error: "no" } : text.toUpperCase());
    expect(parseDraft(col({ parse }), "text", "ab", row, "en")).toEqual({ value: "AB" });
    expect(parseDraft(col({ parse }), "text", "?", row, "en")).toEqual({
      error: "parse",
      message: "no",
    });
    expect(parseDraft(col({ parse: () => new Date(0) }), "text", "", row, "en")).toEqual({
      value: new Date(0),
    });
  });
});

describe("validateValue", () => {
  const row = { n: 1 };
  it("passes without a validator and with an accepted value", async () => {
    expect(await validateValue(col(), 1, row)).toBeNull();
    expect(await validateValue(col({ validate: () => undefined }), 1, row)).toBeNull();
  });

  it("returns the message, sync or async, and turns a throw into a message", async () => {
    expect(await validateValue(col({ validate: () => "bad" }), 1, row)).toBe("bad");
    expect(await validateValue(col({ validate: async () => "later" }), 1, row)).toBe("later");
    expect(
      await validateValue(
        col({
          validate: () => {
            throw new Error("boom");
          },
        }),
        1,
        row,
      ),
    ).toBe("boom");
  });
});

describe("small helpers", () => {
  it("draftText", () => {
    expect(draftText("number", 1234.5, "de-DE")).toBe("1234,5");
    expect(draftText("number", null, "en")).toBe("");
    expect(draftText("date", new Date(2024, 1, 29), "en-US")).toBe("02/29/2024");
    expect(draftText("text", 7, "en")).toBe("7");
  });

  it("sameValue", () => {
    expect(sameValue(null, undefined)).toBe(true);
    expect(sameValue(new Date(5), new Date(5))).toBe(true);
    expect(sameValue(1, "1")).toBe(false);
    expect(sameValue("a", "b")).toBe(false);
  });

  it("normalizeOptions", () => {
    expect(normalizeOptions(["a", { value: 2, label: "Two" }, 3])).toEqual([
      { value: "a", label: "a" },
      { value: 2, label: "Two" },
      { value: 3, label: "3" },
    ]);
  });
});
