import type { ChartSnapshot } from "./chart-protocol.js";

/**
 * SVG and PNG export of a chart drawing, with no dependencies.
 *
 * Charts are themed through CSS variables and Tailwind classes, neither of
 * which survives outside the page. `serializeSvg` therefore bakes the computed
 * paint of every element into inline style before serializing, so the file
 * looks the same wherever it is opened.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

/** Computed properties copied onto the clone as inline style. */
const PAINT_PROPERTIES = [
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "stroke-dasharray",
  "stroke-linecap",
  "stroke-linejoin",
  "opacity",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "letter-spacing",
  "text-anchor",
  "dominant-baseline",
  "stop-color",
  "stop-opacity",
  "visibility",
  "shape-rendering",
] as const;

export interface SerializeOptions {
  /** Paint behind the drawing; transparent when omitted. */
  background?: string;
  /** Gap between stacked drawings, in pixels. */
  gap?: number;
  /** A drawing placed to the left of the whole stack (e.g. the task list of a Gantt). */
  leading?: SVGSVGElement;
}

export interface SerializedSvg {
  markup: string;
  width: number;
  height: number;
}

/** File name from a chart title: lower case, accents removed, dashes, with the extension. */
export function exportFileName(title: string, extension: "svg" | "png" | "csv" | "xlsx"): string {
  const slug = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "chart"}.${extension}`;
}

/** Offsets of drawings stacked top to bottom, and the size of the whole stack. */
export function stackLayout(
  sizes: ReadonlyArray<{ width: number; height: number }>,
  gap = 0,
): { positions: Array<{ x: number; y: number }>; width: number; height: number } {
  let y = 0;
  let width = 0;
  const positions = sizes.map((size) => {
    const position = { x: 0, y };
    y += size.height + gap;
    width = Math.max(width, size.width);
    return position;
  });
  return { positions, width, height: Math.max(0, y - (sizes.length > 0 ? gap : 0)) };
}

function inlinePaint(source: Element, target: Element): void {
  const computed = getComputedStyle(source);
  const style = (target as SVGElement).style;
  for (const property of PAINT_PROPERTIES) {
    const value = computed.getPropertyValue(property);
    if (value) style.setProperty(property, value);
  }
  const from = source.children;
  const to = target.children;
  for (let i = 0; i < from.length; i += 1) {
    const a = from[i];
    const b = to[i];
    if (a && b) inlinePaint(a, b);
  }
}

function sizeOf(svg: SVGSVGElement): { width: number; height: number } {
  const box = svg.getBoundingClientRect();
  return {
    width: svg.width.baseVal.value || box.width,
    height: svg.height.baseVal.value || box.height,
  };
}

/** Serializes one drawing, or several stacked vertically (e.g. a sticky header and its body). */
export function serializeSvg(
  input: SVGSVGElement | readonly SVGSVGElement[],
  { background, gap = 0, leading }: SerializeOptions = {},
): SerializedSvg {
  const sources: readonly SVGSVGElement[] = "length" in input ? input : [input];
  const sizes = sources.map(sizeOf);
  const stack = stackLayout(sizes, gap);
  const lead = leading ? sizeOf(leading) : { width: 0, height: 0 };
  const layout = {
    positions: stack.positions.map((position) => ({ x: position.x + lead.width, y: position.y })),
    width: stack.width + lead.width,
    height: Math.max(stack.height, lead.height),
  };
  const root = document.createElementNS(SVG_NS, "svg");
  root.setAttribute("xmlns", SVG_NS);
  root.setAttribute("width", String(layout.width));
  root.setAttribute("height", String(layout.height));
  root.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);
  if (background) {
    const rect = document.createElementNS(SVG_NS, "rect");
    rect.setAttribute("width", "100%");
    rect.setAttribute("height", "100%");
    rect.setAttribute("fill", background);
    root.appendChild(rect);
  }
  const drawings: Array<{ source: SVGSVGElement; x: number; y: number; w: number; h: number }> =
    sources.map((source, i) => ({
      source,
      x: (layout.positions[i] ?? { x: 0 }).x,
      y: (layout.positions[i] ?? { y: 0 }).y,
      w: (sizes[i] ?? { width: 0 }).width,
      h: (sizes[i] ?? { height: 0 }).height,
    }));
  if (leading) drawings.unshift({ source: leading, x: 0, y: 0, w: lead.width, h: lead.height });
  for (const { source, x, y, w, h } of drawings) {
    const clone = source.cloneNode(true) as SVGSVGElement;
    inlinePaint(source, clone);
    for (const skip of clone.querySelectorAll("[data-export-skip]")) skip.remove();
    clone.setAttribute("x", String(x));
    clone.setAttribute("y", String(y));
    clone.setAttribute("width", String(w));
    clone.setAttribute("height", String(h));
    clone.removeAttribute("class");
    clone.removeAttribute("aria-hidden");
    for (const layoutProperty of ["position", "left", "top", "pointer-events"]) {
      clone.style.removeProperty(layoutProperty);
    }
    root.appendChild(clone);
  }
  return {
    markup: new XMLSerializer().serializeToString(root),
    width: layout.width,
    height: layout.height,
  };
}

function save(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The page background is the sensible default behind an exported drawing. */
function pageBackground(): string {
  const value = getComputedStyle(document.body).backgroundColor;
  return value && value !== "rgba(0, 0, 0, 0)" ? value : "#ffffff";
}

export interface ExportOptions extends SerializeOptions {
  fileName: string;
}

export function downloadSvg(
  input: SVGSVGElement | readonly SVGSVGElement[],
  { fileName, ...options }: ExportOptions,
): void {
  const { markup } = serializeSvg(input, { background: pageBackground(), ...options });
  save(new Blob([markup], { type: "image/svg+xml;charset=utf-8" }), fileName);
}

/** Rasterizes through an `<img>` and a canvas; `scale` 2 gives retina sharpness. */
export async function downloadPng(
  input: SVGSVGElement | readonly SVGSVGElement[],
  { fileName, scale = 2, ...options }: ExportOptions & { scale?: number },
): Promise<void> {
  const { markup, width, height } = serializeSvg(input, {
    background: pageBackground(),
    ...options,
  });
  const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("The drawing could not be rasterized."));
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is not available.");
    context.scale(scale, scale);
    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (blob) save(blob, fileName);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---- tabular export ---------------------------------------------------------------------------

/** Escapes one CSV field (RFC 4180). Text that a spreadsheet would run as a formula gets a leading `'`. */
function csvField(value: string | number | Date | null | undefined): string {
  if (value == null) return "";
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** The snapshot as CSV text: a header row, then one row per category with raw values. */
export function snapshotCsv(snapshot: ChartSnapshot): string {
  const rows: string[] = [
    [snapshot.categoryHeader, ...snapshot.series.map((s) => s.name)].map(csvField).join(","),
  ];
  snapshot.categories.forEach((category, row) => {
    const head = snapshot.categoryValues?.[row] ?? category;
    rows.push(
      [head, ...snapshot.series.map((s) => s.values[row])].map((v) => csvField(v)).join(","),
    );
  });
  return `${rows.join("\r\n")}\r\n`;
}

/** Downloads the snapshot as CSV (UTF-8 with a BOM, so spreadsheets read accents correctly). */
export function downloadCsv(snapshot: ChartSnapshot, fileName: string): void {
  save(new Blob([`\uFEFF${snapshotCsv(snapshot)}`], { type: "text/csv;charset=utf-8" }), fileName);
}

/** Downloads the snapshot as .xlsx. The writer is a separate chunk, fetched only here. */
export async function downloadXlsx(snapshot: ChartSnapshot, fileName: string): Promise<void> {
  const { buildXlsx, XLSX_MIME } = await import("@jcsoftdev/ui-core/xlsx");
  const bytes = buildXlsx({
    sheets: [
      {
        name: snapshot.title || "Data",
        columns: [
          { header: snapshot.categoryHeader },
          ...snapshot.series.map((s) => ({ header: s.name })),
        ],
        rows: snapshot.categories.map((category, row) => [
          snapshot.categoryValues?.[row] ?? category,
          ...snapshot.series.map((s) => s.values[row]),
        ]),
      },
    ],
  });
  save(new Blob([bytes as BlobPart], { type: XLSX_MIME }), fileName);
}
