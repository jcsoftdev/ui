import { describe, expect, it } from "vitest";
import * as react from "../../ui/src/xlsx/index.ts";
import {
  buildXlsx,
  columnName,
  crc32,
  createZip,
  escapeXml,
  excelSerial,
  sheetName,
} from "../src/xlsx.ts";

const date = new Date(2026, 9, 13, 8, 30, 15);
const workbook = {
  creator: "jcsoftdev <&>",
  date,
  sheets: [
    {
      name: "Ventas: [2026]/Q4?",
      columns: [
        { header: "Producto", align: "left" as const },
        { header: "Monto", format: "currency" },
        { header: "Pct", format: "0.0%" },
        { header: "Fecha", format: "date" },
        { header: "OK" },
      ],
      rows: [
        ["Corte <fade>", 35.5, 0.125, new Date(2026, 0, 2, 3, 4), true],
        ["  padded\nline ", 1e21, Number.NaN, new Date("x"), false],
        [null, undefined, "", null, "text"],
      ],
    },
    { name: "ventas: [2026]/q4?", columns: [], rows: [] },
  ],
};

describe("crc32", () => {
  it("matches the IEEE check value and chunking", () => {
    const bytes = new TextEncoder().encode("123456789");
    expect(crc32(bytes)).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
    expect(crc32(bytes.subarray(4), crc32(bytes.subarray(0, 4)))).toBe(0xcbf43926);
    expect(crc32(bytes)).toBe(react.crc32(bytes));
  });
});

describe("xlsx writer: parity with the React kit", () => {
  it("builds byte-identical workbooks", () => {
    expect(buildXlsx(workbook)).toEqual(react.buildXlsx(workbook));
    expect(buildXlsx({ sheets: [] })).toHaveLength(react.buildXlsx({ sheets: [] }).length);
  });

  it("createZip is byte-identical, with valid signatures and CRCs", () => {
    const entries = [
      { name: "a.txt", data: new TextEncoder().encode("hello") },
      { name: "dir/ñ.bin", data: new Uint8Array([0, 1, 2, 255]) },
    ];
    const mine = createZip(entries, { date });
    expect(mine).toEqual(react.createZip(entries, { date }));
    const view = new DataView(mine.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint32(14, true)).toBe(crc32(entries[0]!.data));
    expect(view.getUint32(mine.length - 22, true)).toBe(0x06054b50);
    expect(view.getUint16(mine.length - 12, true)).toBe(2);
  });

  it("helpers match", () => {
    for (const n of [0, 25, 26, 27, 701, 702, 16383])
      expect(columnName(n)).toBe(react.columnName(n));
    expect(columnName(26)).toBe("AA");
    expect(excelSerial(new Date(2020, 0, 1))).toBe(react.excelSerial(new Date(2020, 0, 1)));
    expect(excelSerial(new Date(1970, 0, 1))).toBe(25569);
    expect(sheetName("a/b:c", new Set(["a b c"]))).toBe(
      react.sheetName("a/b:c", new Set(["a b c"])),
    );
    expect(escapeXml("<a&\"'\u0001>")).toBe("&lt;a&amp;&quot;&apos;&gt;");
  });

  it("stores the entries a spreadsheet needs", () => {
    const text = new TextDecoder().decode(buildXlsx(workbook));
    for (const part of [
      "[Content_Types].xml",
      "xl/workbook.xml",
      "xl/worksheets/sheet1.xml",
      "xl/styles.xml",
      "xl/sharedStrings.xml",
    ])
      expect(text).toContain(part);
    expect(text).toContain("&lt;fade&gt;");
    expect(text).not.toContain("<fade>");
  });

  it("rejects archives that exceed the ZIP limits", () => {
    expect(() =>
      createZip(Array.from({ length: 0x10000 }, () => ({ name: "x", data: new Uint8Array() }))),
    ).toThrow(RangeError);
  });
});
