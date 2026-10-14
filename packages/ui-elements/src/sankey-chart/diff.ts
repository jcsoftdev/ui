// The compare (diff) view of the sankey chart, loaded the first time `compare` is set: the ghost
// bands, the signed change text, the tooltip rows and the table columns of a diff.
import { type SankeyDiffLink, type SankeyLink, sankeyDiff } from "@jcsoftdev/ui-core/chart/sankey";
import { svg, type TooltipRow } from "../internal/chart-base.js";
import { sharePercent } from "../internal/chart-flow.js";

export { sankeyDiff };

type Format = (value: number) => string;
interface DiffText {
  before: string;
  after: string;
  change: string;
}

export const toneOf = (entry: Pick<SankeyDiffLink, "delta">): string =>
  entry.delta > 0 ? "var(--chart-up)" : entry.delta < 0 ? "var(--chart-down)" : "var(--ink-3)";

/** "+12 (+8.5%)" for a diff link. */
export function signed(
  entry: Pick<SankeyDiffLink, "before" | "delta">,
  format: Format,
  locale: string,
): string {
  const sign = entry.delta > 0 ? "+" : entry.delta < 0 ? "-" : "";
  const amount = `${sign}${format(Math.abs(entry.delta))}`;
  if (entry.before <= 0) return amount;
  return `${amount} (${sign}${sharePercent(Math.abs(entry.delta) / entry.before, locale)})`;
}

/** The previous band (grey) and the current one (tinted by the change; dashed when it vanished). */
export function ghostOf(d: string, entry: SankeyDiffLink, ky: number): SVGGElement {
  const tone = toneOf(entry);
  return svg(
    "g",
    { "data-ghost": "" },
    svg("path", {
      d,
      "stroke-width": Math.max(1, entry.before * ky),
      style: "stroke:var(--ink-3);stroke-opacity:.2",
    }),
    entry.after > 0
      ? svg("path", {
          d,
          "stroke-width": Math.max(1, entry.after * ky),
          style: `stroke:${tone};stroke-opacity:.58`,
        })
      : svg("path", {
          d,
          "stroke-width": Math.max(1, entry.before * ky),
          "stroke-dasharray": "5 4",
          style: `stroke:${tone};stroke-opacity:.7`,
        }),
  );
}

const rowsOf = (
  before: number,
  after: number,
  tone: string,
  text: DiffText,
  format: Format,
  locale: string,
): TooltipRow[] => [
  { id: "before", name: text.before, value: format(before), color: "var(--ink-3)" },
  { id: "after", name: text.after, value: format(after), color: tone },
  {
    id: "change",
    name: text.change,
    value: signed({ before, delta: after - before }, format, locale) || "0",
    color: "transparent",
    emphasis: true,
  },
];

/** Tooltip rows of a node: the sums of the diff entries of its flows. */
export function nodeRows(
  flows: readonly SankeyLink[],
  byId: ReadonlyMap<string, SankeyDiffLink>,
  tone: string,
  text: DiffText,
  format: Format,
  locale: string,
): TooltipRow[] {
  let before = 0;
  let after = 0;
  for (const link of flows) {
    const entry = byId.get(link.id) as SankeyDiffLink;
    before += entry.before;
    after += entry.after;
  }
  return rowsOf(before, after, tone, text, format, locale);
}

export const linkRows = (
  entry: SankeyDiffLink,
  text: DiffText,
  format: Format,
  locale: string,
): TooltipRow[] => rowsOf(entry.before, entry.after, toneOf(entry), text, format, locale);

/** The before, after and change columns of the data table (one row per node, then per link). */
export function series(
  rows: ReadonlyArray<{ before: number | null; after: number | null; delta: number | null }>,
  text: DiffText,
  format: Format,
  locale: string,
  color: string,
) {
  const column = (
    id: string,
    name: string,
    pick: (row: (typeof rows)[number]) => number | null,
    show: (value: number, row: (typeof rows)[number]) => string,
  ) => ({
    id,
    name,
    color,
    values: rows.map(pick),
    text: rows.map((row) => {
      const value = pick(row);
      return value == null ? "" : show(value, row);
    }),
  });
  return [
    column("before", text.before, (row) => row.before, format),
    column("after", text.after, (row) => row.after, format),
    column(
      "change",
      text.change,
      (row) => row.delta,
      (delta, row) => signed({ before: row.before ?? 0, delta }, format, locale),
    ),
  ];
}
