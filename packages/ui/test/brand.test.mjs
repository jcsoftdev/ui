// Pure logic behind Logo Forge: initials, seeded determinism, SVG serialization safety.
import assert from "node:assert/strict";
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

const { getInitials } = await load("../src/brand/initials.ts");
const { generateMark, generateVariations, serializeMark, escapeXml, MARK_SHAPES } = await load(
  "../src/brand/generate.ts",
);

test("initials: multi-word names skip articles", () => {
  assert.equal(getInitials("Barbería Don Lucho", 3), "BDL");
  assert.equal(getInitials("Barbería Don Lucho", 2), "BD");
  assert.equal(getInitials("Salón de la Esquina", 2), "SE");
  assert.equal(getInitials("Peluquería y Barbería Lima", 3), "PBL");
});

test("initials: accents are removed and the Ñ is kept", () => {
  assert.equal(getInitials("Álvaro Ángeles", 2), "AA");
  assert.equal(getInitials("Ñandú Éxito", 2), "ÑE");
  assert.equal(getInitials("élite", 1), "E");
});

test("initials: short names borrow letters from the first word", () => {
  assert.equal(getInitials("Lucho", 2), "LU");
  assert.equal(getInitials("Don Lucho", 3), "DLO");
  assert.equal(getInitials("", 2), "");
  assert.equal(getInitials("!!!", 2), "");
});

test("generateMark is deterministic per seed and differs across seeds", () => {
  const options = { name: "Barbería Don Lucho", layout: "stacked", fill: "gradient", seed: 7 };
  const a = serializeMark(generateMark(options));
  const b = serializeMark(generateMark({ ...options }));
  assert.equal(a, b);
  const outputs = new Set(
    [0, 1, 2, 3, 4, 5, 6, 7].map((seed) => serializeMark(generateMark({ ...options, seed }))),
  );
  assert.ok(outputs.size > 3, "seeds should produce visibly different marks");
});

test("variations are deterministic, distinct and paged", () => {
  const base = { name: "Barbería Don Lucho", layout: "icon" };
  const first = generateVariations(base, 12, 0);
  assert.equal(first.length, 12);
  assert.deepEqual(first, generateVariations(base, 12, 0));
  assert.notDeepEqual(first, generateVariations(base, 12, 1));
  const svgs = new Set(first.map((v) => serializeMark(generateMark(v))));
  assert.ok(svgs.size >= 10);
});

test("every shape, layout and fill yields a valid viewBox", () => {
  for (const shape of MARK_SHAPES) {
    for (const layout of ["icon", "horizontal", "stacked"]) {
      for (const fill of ["solid", "gradient", "outline"]) {
        for (const monogram of ["initials", "glyph"]) {
          const mark = generateMark({
            name: "Barbería Don Lucho",
            tagline: "Corte y navaja",
            shape,
            layout,
            fill,
            monogram,
            seed: 3,
          });
          const parts = mark.viewBox.split(" ").map(Number);
          assert.equal(parts.length, 4);
          assert.ok(parts.every(Number.isFinite));
          assert.equal(parts[0], 0);
          assert.equal(parts[1], 0);
          assert.ok(parts[2] >= 100 && parts[3] >= 100);
          assert.equal(parts[2], mark.width);
          assert.equal(parts[3], mark.height);
        }
      }
    }
  }
});

test("monogram contrast: dark fills get white content, pale fills get the ink", () => {
  const dark = serializeMark(
    generateMark({ name: "Don Lucho", palette: "navaja", shape: "circle" }),
  );
  assert.match(dark, /<text[^>]*fill="#ffffff"/);
  const pale = serializeMark(
    generateMark({ name: "Don Lucho", palette: "menta", shape: "circle" }),
  );
  assert.match(pale, /<text[^>]*fill="#002f1f"/);
});

test("serialization escapes text and attributes", () => {
  const evil = `</text><script>alert(1)</script>"&'`;
  const svg = serializeMark(
    generateMark({
      name: evil,
      tagline: evil,
      initials: "<A",
      layout: "stacked",
      palette: {
        id: "x",
        label: "x",
        primary: `red" onload="alert(1)`,
        secondary: "#fff",
        ink: "javascript:1",
      },
      background: `"><script>1</script>`,
      wordmarkColor: `</svg>`,
    }),
  );
  assert.ok(!svg.includes("<script"), svg);
  assert.ok(!/ onload=/.test(svg));
  assert.ok(!svg.includes("</svg><"));
  assert.ok(svg.startsWith("<svg xmlns="));
  assert.ok(svg.endsWith("</svg>"));
  assert.equal(svg.match(/<svg/g).length, 1);
  assert.equal(escapeXml(`<&>"'`), "&lt;&amp;&gt;&quot;&#39;");
  assert.equal(escapeXml("a\u0000b"), "ab");
});

test("serialized SVG is well-formed (balanced tags)", () => {
  const svg = serializeMark(
    generateMark({
      name: "Don Lucho",
      tagline: "Navaja",
      layout: "horizontal",
      fill: "gradient",
      shape: "none",
      monogram: "glyph",
    }),
  );
  const opens = (svg.match(/<[a-zA-Z][^>]*(?<!\/)>/g) ?? []).length;
  const closes = (svg.match(/<\/[a-zA-Z]+>/g) ?? []).length;
  assert.equal(opens, closes);
  assert.match(svg, /viewBox="0 0 [\d.]+ [\d.]+"/);
});
