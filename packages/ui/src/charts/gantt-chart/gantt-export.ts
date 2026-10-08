const SVG_NS = "http://www.w3.org/2000/svg";

export interface TaskListRow {
  name: string;
  depth: number;
  parent: boolean;
  collapsed: boolean;
  /** Dates and progress, in the order of `columns`. */
  cells: readonly string[];
}

export interface TaskListOptions {
  rows: readonly TaskListRow[];
  /** Header labels and widths of the visible columns. */
  columns: ReadonlyArray<{ label: string; width: number }>;
  tasksLabel: string;
  width: number;
  headerHeight: number;
  rowHeight: number;
}

function node<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
  style?: string,
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, String(value));
  if (style) element.setAttribute("style", style);
  return element;
}

function text(
  content: string,
  attrs: Record<string, string | number>,
  style: string,
): SVGTextElement {
  const element = node("text", attrs, style);
  element.textContent = content;
  return element;
}

/**
 * Task-name list of a Gantt as a drawing: header, one row per task (indented by depth, with a
 * chevron on parents) and the date / progress columns. It must be mounted inside the chart so
 * its design tokens resolve; the caller removes it after exporting.
 */
export function buildTaskListSvg({
  rows,
  columns,
  tasksLabel,
  width,
  headerHeight,
  rowHeight,
}: TaskListOptions): SVGSVGElement {
  const height = headerHeight + rows.length * rowHeight;
  const svg = node("svg", { width, height, viewBox: `0 0 ${width} ${height}` });
  const columnsWidth = columns.reduce((sum, column) => sum + column.width, 0);
  const nameWidth = Math.max(0, width - columnsWidth);

  svg.appendChild(node("rect", { width, height }, "fill:var(--surface)"));
  const headerY = headerHeight - headerHeight / 4;
  const headStyle = "font-size:11px;font-weight:600;fill:var(--ink-3)";
  svg.appendChild(
    text(tasksLabel, { x: 12, y: headerY, "dominant-baseline": "middle" }, headStyle),
  );
  let right = width;
  for (let i = columns.length - 1; i >= 0; i -= 1) {
    const column = columns[i] as { label: string; width: number };
    svg.appendChild(
      text(
        column.label,
        { x: right - 12, y: headerY, "text-anchor": "end", "dominant-baseline": "middle" },
        headStyle,
      ),
    );
    right -= column.width;
  }
  svg.appendChild(
    node(
      "line",
      { x1: 0, x2: width, y1: headerHeight - 0.5, y2: headerHeight - 0.5 },
      "stroke:var(--line-strong);stroke-width:1",
    ),
  );

  rows.forEach((row, index) => {
    const top = headerHeight + index * rowHeight;
    const middle = top + rowHeight / 2;
    svg.appendChild(
      node(
        "line",
        { x1: 0, x2: width, y1: top + rowHeight - 0.5, y2: top + rowHeight - 0.5 },
        "stroke:var(--chart-grid);stroke-width:1",
      ),
    );
    const indent = 8 + row.depth * 14;
    if (row.parent) {
      const cx = indent + 10;
      const d = row.collapsed
        ? `M${cx - 1.5},${middle - 3.5}L${cx + 2},${middle}L${cx - 1.5},${middle + 3.5}`
        : `M${cx - 3.5},${middle - 1.5}L${cx},${middle + 2}L${cx + 3.5},${middle - 1.5}`;
      svg.appendChild(
        node("path", { d }, "fill:none;stroke:var(--ink-3);stroke-width:1.6;stroke-linecap:round"),
      );
    }
    const labelX = indent + 24;
    const cell = node("svg", {
      x: labelX,
      y: top,
      width: Math.max(0, nameWidth - labelX - 8),
      height: rowHeight,
    });
    cell.appendChild(
      text(
        row.name,
        { x: 0, y: rowHeight / 2, "dominant-baseline": "middle" },
        `font-size:12px;${row.parent ? "font-weight:700;fill:var(--ink)" : "fill:var(--ink-2)"}`,
      ),
    );
    svg.appendChild(cell);
    let edge = width;
    for (let i = columns.length - 1; i >= 0; i -= 1) {
      const column = columns[i] as { label: string; width: number };
      svg.appendChild(
        text(
          row.cells[i] ?? "",
          { x: edge - 12, y: middle, "text-anchor": "end", "dominant-baseline": "middle" },
          "font-size:11.5px;fill:var(--ink-3)",
        ),
      );
      edge -= column.width;
    }
  });
  svg.appendChild(
    node("line", { x1: width - 0.5, x2: width - 0.5, y1: 0, y2: height }, "stroke:var(--line)"),
  );
  return svg;
}
