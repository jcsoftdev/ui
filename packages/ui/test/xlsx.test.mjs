// XLSX export: CRC-32, ZIP structure, OOXML parts and the grid-to-sheet mapping.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));

async function load(file) {
  const bundle = await build({
    entryPoints: [join(here, file)],
    bundle: true,
    format: "esm",
    platform: "neutral",
    write: false,
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`
  );
}

const xlsx = await load("../src/xlsx/index.ts");
const gridExport = await load("../src/containers/data-grid/xlsx-export.ts");

const text = (value) => new TextEncoder().encode(value);
const decode = (bytes) => new TextDecoder().decode(bytes);

// ---- tiny ZIP reader (central directory), independent from the writer -----------------------

function readZip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = bytes.length - 22;
  assert.equal(view.getUint32(eocd, true), 0x06054b50, "end of central directory signature");
  const count = view.getUint16(eocd + 10, true);
  assert.equal(view.getUint16(eocd + 8, true), count);
  const size = view.getUint32(eocd + 12, true);
  const start = view.getUint32(eocd + 16, true);
  assert.equal(start + size, eocd, "central directory ends where the end record starts");
  const entries = [];
  let at = start;
  for (let i = 0; i < count; i += 1) {
    assert.equal(view.getUint32(at, true), 0x02014b50, "central header signature");
    const method = view.getUint16(at + 10, true);
    const crc = view.getUint32(at + 16, true);
    const compressed = view.getUint32(at + 20, true);
    const original = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const offset = view.getUint32(at + 42, true);
    const name = decode(bytes.subarray(at + 46, at + 46 + nameLength));
    assert.equal(view.getUint32(offset, true), 0x04034b50, "local header signature");
    const localName = view.getUint16(offset + 26, true);
    const localExtra = view.getUint16(offset + 28, true);
    const dataStart = offset + 30 + localName + localExtra;
    assert.equal(decode(bytes.subarray(offset + 30, offset + 30 + localName)), name);
    assert.equal(view.getUint32(offset + 14, true), crc, "local and central CRC agree");
    entries.push({
      name,
      method,
      crc,
      compressed,
      original,
      data: bytes.subarray(dataStart, dataStart + compressed),
    });
    at += 46 + nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
  }
  assert.equal(at, eocd);
  return entries;
}

// ---- tiny XML well-formedness check ---------------------------------------------------------

// biome-ignore lint/suspicious/noControlCharactersInRegex: XML 1.0 forbids these characters.
const FORBIDDEN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;

function assertWellFormed(xml, label) {
  assert.ok(xml.startsWith("<?xml"), `${label}: declaration`);
  const body = xml.replace(/^<\?xml[^>]*\?>\s*/, "");
  const stack = [];
  const name = "[A-Za-z_][\\w.:-]*";
  const attribute = new RegExp(`\\s+${name}="[^"<]*"`, "g");
  const tag = new RegExp(`^<(\\/)?(${name})((?:\\s+${name}="[^"<]*")*)\\s*(\\/)?>$`);
  const parts = body.split(/(<[^>]*>)/).filter((part) => part !== "");
  let roots = 0;
  for (const part of parts) {
    if (part.startsWith("<")) {
      const match = tag.exec(part);
      assert.ok(match, `${label}: bad tag ${part.slice(0, 60)}`);
      const [, closing, tagName, attrs, selfClosing] = match;
      assert.equal(
        (attrs.match(attribute) ?? []).join(""),
        attrs,
        `${label}: attributes of ${tagName}`,
      );
      if (closing) {
        assert.equal(stack.pop(), tagName, `${label}: </${tagName}> closes the open tag`);
      } else {
        if (stack.length === 0) roots += 1;
        if (!selfClosing) stack.push(tagName);
      }
    } else {
      assert.ok(!part.includes("<"), `${label}: raw < in text`);
      assert.ok(
        !/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/.test(part),
        `${label}: bare &`,
      );
      assert.ok(!FORBIDDEN.test(part), `${label}: control character`);
    }
  }
  assert.equal(stack.length, 0, `${label}: unclosed tags ${stack.join(",")}`);
  assert.equal(roots, 1, `${label}: one root element`);
}

// ---- CRC-32 ---------------------------------------------------------------------------------

test("crc32 matches the published check values", () => {
  assert.equal(xlsx.crc32(text("")), 0);
  assert.equal(xlsx.crc32(text("a")), 0xe8b7be43);
  assert.equal(xlsx.crc32(text("abc")), 0x352441c2);
  assert.equal(xlsx.crc32(text("123456789")), 0xcbf43926);
  assert.equal(xlsx.crc32(text("The quick brown fox jumps over the lazy dog")), 0x414fa339);
  assert.equal(xlsx.crc32(new Uint8Array(32)), 0x190a55ad);
  assert.equal(xlsx.crc32(new Uint8Array(32).fill(0xff)), 0xff6cab0b);
});

test("crc32 can be fed in chunks", () => {
  const whole = text("The quick brown fox jumps over the lazy dog");
  const chunked = xlsx.crc32(whole.subarray(10), xlsx.crc32(whole.subarray(0, 10)));
  assert.equal(chunked, xlsx.crc32(whole));
});

// ---- ZIP ------------------------------------------------------------------------------------

test("createZip stores entries with correct headers, offsets and checksums", () => {
  const files = [
    { name: "a.txt", data: text("hola") },
    { name: "dir/ñandú.txt", data: text("contenido con acentos: áéíóú") },
    { name: "empty.bin", data: new Uint8Array(0) },
  ];
  const zip = xlsx.createZip(files, { date: new Date(2026, 9, 8, 14, 30, 10) });
  const entries = readZip(zip);
  assert.deepEqual(
    entries.map((entry) => entry.name),
    files.map((file) => file.name),
  );
  entries.forEach((entry, index) => {
    const source = files[index].data;
    assert.equal(entry.method, 0, "STORE");
    assert.equal(entry.compressed, source.length);
    assert.equal(entry.original, source.length);
    assert.equal(entry.crc, xlsx.crc32(source));
    assert.deepEqual([...entry.data], [...source]);
  });
});

test("dosDateTime packs local date and time", () => {
  const stamp = xlsx.dosDateTime(new Date(2026, 9, 8, 14, 30, 10));
  assert.equal(stamp.date, ((2026 - 1980) << 9) | (10 << 5) | 8);
  assert.equal(stamp.time, (14 << 11) | (30 << 5) | 5);
  assert.equal(xlsx.dosDateTime(new Date(1970, 0, 1)).date >> 9, 0);
});

test("an empty archive is just the end record", () => {
  const zip = xlsx.createZip([]);
  assert.equal(zip.length, 22);
  assert.deepEqual(readZip(zip), []);
});

// ---- helpers --------------------------------------------------------------------------------

test("excelSerial counts days since 1899-12-30 in local time", () => {
  assert.equal(xlsx.excelSerial(new Date(2000, 0, 1)), 36526);
  assert.equal(xlsx.excelSerial(new Date(2024, 0, 1)), 45292);
  assert.equal(xlsx.excelSerial(new Date(1900, 2, 1)), 61);
  assert.equal(xlsx.excelSerial(new Date(2024, 0, 1, 12)), 45292.5);
});

test("columnName and sheetName follow Excel rules", () => {
  assert.equal(xlsx.columnName(0), "A");
  assert.equal(xlsx.columnName(26), "AA");
  assert.equal(xlsx.columnName(702), "AAA");
  assert.equal(xlsx.sheetName("Ventas: [octubre]/2026?"), "Ventas   octubre  2026");
  assert.equal(xlsx.sheetName("x".repeat(40)).length, 31);
  assert.equal(xlsx.sheetName("", new Set()), "Hoja");
  assert.equal(xlsx.sheetName("Datos", new Set(["datos"])), "Datos (2)");
  assert.equal(xlsx.escapeXml('a<b & "c"\u0001'), "a&lt;b &amp; &quot;c&quot;");
});

// ---- workbook -------------------------------------------------------------------------------

const sample = {
  creator: "jcsoftdev",
  date: new Date(Date.UTC(2026, 9, 8, 12, 0, 0)),
  sheets: [
    {
      name: "Ventas",
      columns: [
        { header: "Cliente" },
        { header: "Fecha", format: "date" },
        { header: "Total", format: "currency", align: "right" },
        { header: "Cantidad", format: "integer" },
        { header: "Pagado" },
      ],
      rows: [
        ["Álvaro <Quispe> & Cía", new Date(2026, 9, 6), 35, 2, true],
        ["Bruno", new Date(2026, 9, 7, 15, 30), 52.5, 3, false],
        ["Álvaro <Quispe> & Cía", null, undefined, Number.NaN, ""],
        ["  espacios  ", new Date(Number.NaN), 0, 1, true],
      ],
    },
  ],
};

test("buildXlsx produces a ZIP with the OOXML parts of a workbook", () => {
  const entries = readZip(xlsx.buildXlsx(sample));
  assert.deepEqual(
    entries.map((entry) => entry.name),
    [
      "[Content_Types].xml",
      "_rels/.rels",
      "docProps/core.xml",
      "xl/workbook.xml",
      "xl/_rels/workbook.xml.rels",
      "xl/worksheets/sheet1.xml",
      "xl/styles.xml",
      "xl/sharedStrings.xml",
    ],
  );
  for (const entry of entries) {
    assert.equal(entry.method, 0);
    assert.equal(entry.crc, xlsx.crc32(entry.data), entry.name);
    assertWellFormed(decode(entry.data), entry.name);
  }
});

test("worksheet keeps numbers as numbers, dates as serials, text as shared strings", () => {
  const entries = Object.fromEntries(
    readZip(xlsx.buildXlsx(sample)).map((entry) => [entry.name, decode(entry.data)]),
  );
  const sheet = entries["xl/worksheets/sheet1.xml"];
  const shared = entries["xl/sharedStrings.xml"];
  const styles = entries["xl/styles.xml"];

  assert.match(sheet, /<dimension ref="A1:E5"\/>/);
  assert.match(sheet, /state="frozen"/);
  assert.match(sheet, /<c r="C2" s="\d+"><v>35<\/v><\/c>/);
  assert.match(sheet, /<c r="C3" s="\d+"><v>52.5<\/v><\/c>/);
  assert.match(sheet, /<c r="D2" s="\d+"><v>2<\/v><\/c>/);
  assert.match(sheet, /<c r="B2" s="\d+"><v>46301<\/v><\/c>/);
  assert.match(sheet, /<c r="B3" s="\d+"><v>46302.6458333/);
  assert.match(sheet, /<c r="E2" s="\d+" t="b"><v>1<\/v><\/c>/);
  assert.match(sheet, /<c r="E3" s="\d+" t="b"><v>0<\/v><\/c>/);
  assert.doesNotMatch(sheet, /r="C4"|r="D4"|r="B5"/, "empty, NaN and invalid dates are skipped");
  assert.match(sheet, /<c r="A1" s="1" t="s">/, "header uses the bold style");

  assert.match(shared, /uniqueCount="8"/);
  assert.match(shared, /count="9"/);
  assert.match(shared, /<t>Álvaro &lt;Quispe&gt; &amp; Cía<\/t>/);
  assert.match(shared, /<t xml:space="preserve"> {2}espacios {2}<\/t>/);

  assert.match(styles, /<b\/>/);
  assert.match(styles, /formatCode="yyyy-mm-dd"/);
  assert.match(styles, /formatCode="&quot;S\/&quot; #,##0.00"/);
  assert.match(styles, /numFmtId="3"/);
  assert.match(styles, /horizontal="right"/);
});

test("the date of a column with times uses the datetime format and several sheets get unique names", () => {
  const entries = Object.fromEntries(
    readZip(
      xlsx.buildXlsx({
        sheets: [
          {
            name: "Datos",
            columns: [{ header: "Cuándo", format: "datetime" }],
            rows: [[new Date(2026, 9, 8, 9, 15)]],
          },
          { name: "datos", columns: [{ header: "N", format: "0.0%" }], rows: [[0.256]] },
        ],
      }),
    ).map((entry) => [entry.name, decode(entry.data)]),
  );
  assert.match(entries["xl/styles.xml"], /formatCode="yyyy-mm-dd hh:mm"/);
  assert.match(entries["xl/styles.xml"], /formatCode="0.0%"/);
  assert.match(entries["xl/workbook.xml"], /name="Datos" sheetId="1"/);
  assert.match(entries["xl/workbook.xml"], /name="datos \(2\)" sheetId="2"/);
  assert.ok(entries["xl/worksheets/sheet2.xml"]);
  assertWellFormed(entries["xl/workbook.xml"], "workbook");
});

test("unzip and xmllint accept the file when they are installed", (t) => {
  const available = (command) =>
    spawnSync(command, ["--version"], { stdio: "ignore" }).error === undefined;
  const unzipOk = spawnSync("unzip", ["-v"], { stdio: "ignore" }).error === undefined;
  if (!unzipOk) {
    t.skip("unzip is not installed");
    return;
  }
  const dir = mkdtempSync(join(tmpdir(), "ui-xlsx-"));
  try {
    const file = join(dir, "ventas.xlsx");
    writeFileSync(file, xlsx.buildXlsx(sample));
    const listing = execFileSync("unzip", ["-l", file], { encoding: "utf8" });
    for (const part of [
      "[Content_Types].xml",
      "xl/workbook.xml",
      "xl/worksheets/sheet1.xml",
      "xl/styles.xml",
      "xl/sharedStrings.xml",
    ]) {
      assert.ok(listing.includes(part), `unzip -l lists ${part}`);
    }
    const tested = execFileSync("unzip", ["-t", file], { encoding: "utf8" });
    assert.match(tested, /No errors detected/);
    if (available("xmllint")) {
      for (const part of [
        "xl/workbook.xml",
        "xl/worksheets/sheet1.xml",
        "xl/styles.xml",
        "xl/sharedStrings.xml",
        "[Content_Types].xml",
      ]) {
        const xml = execFileSync("unzip", ["-p", file, part.replace(/[[\]]/g, "\\$&")]);
        const result = spawnSync("xmllint", ["--noout", "-"], { input: xml, encoding: "utf8" });
        assert.equal(result.status, 0, `xmllint ${part}: ${result.stderr}`);
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---- grid mapping ---------------------------------------------------------------------------

test("gridToSheet maps column types to formats and keeps typed values", () => {
  const columns = [
    { id: "cliente", header: "Cliente", accessor: "cliente" },
    { id: "fecha", header: "Fecha", accessor: "fecha", type: "date" },
    { id: "hora", header: "Hora", accessor: "hora", type: "date" },
    { id: "total", header: "Total", accessor: "total", type: "currency" },
    { id: "cant", header: "Cant.", accessor: "cant", type: "number" },
    { id: "peso", header: "Peso", accessor: "peso", type: "number", align: "center" },
  ];
  const rows = [
    {
      cliente: "Álvaro",
      fecha: new Date(2026, 9, 6),
      hora: new Date(2026, 9, 6, 9, 30),
      total: 35,
      cant: 2,
      peso: 1.5,
    },
    {
      cliente: "Bruno",
      fecha: new Date(2026, 9, 7),
      hora: new Date(2026, 9, 7),
      total: null,
      cant: 3,
      peso: 2,
    },
  ];
  const sheet = gridExport.gridToSheet(rows, columns, "Ventas");
  assert.equal(sheet.name, "Ventas");
  assert.deepEqual(
    sheet.columns.map((column) => [column.header, column.format, column.align]),
    [
      ["Cliente", "general", "left"],
      ["Fecha", "date", "left"],
      ["Hora", "datetime", "left"],
      ["Total", "currency", "right"],
      ["Cant.", "integer", "right"],
      ["Peso", "decimal", "center"],
    ],
  );
  assert.equal(sheet.rows[0][3], 35);
  assert.ok(sheet.rows[0][1] instanceof Date);
  assert.equal(sheet.rows[1][3], null);
  assert.equal(gridExport.xlsxFilename("ventas.csv"), "ventas.xlsx");
  assert.equal(gridExport.xlsxFilename("ventas"), "ventas.xlsx");
  assert.equal(gridExport.xlsxFilename("ventas.XLSX"), "ventas.XLSX");
  const bytes = xlsx.buildXlsx({ sheets: [sheet] });
  assert.equal(String.fromCharCode(bytes[0], bytes[1]), "PK");
});
