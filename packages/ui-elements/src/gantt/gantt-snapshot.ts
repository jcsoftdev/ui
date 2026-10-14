import type { ChartSnapshot, DrawContext } from "../internal/chart-base.js";
import { ganttRows } from "../internal/e23-gantt.js";
import type { GanttTask } from "../internal/e23-gantt-layout.js";
import type { GanttTexts } from "./gantt.js";

/** What the screen-reader table needs; the chart passes its formatters so they stay in one place. */
export interface SnapshotInput {
  tasks: readonly GanttTask[];
  label: string | null;
  baselines: boolean;
  timeZone: string | undefined;
  texts: GanttTexts;
  critical: { tasks: ReadonlySet<string> } | null;
  hasBaselineTasks: boolean;
  format: (time: number) => string;
  span: (start: number, end: number) => string;
  percent: (value: number) => string;
  displayEnd: (start: number, end: number, tz?: string) => number;
  color: DrawContext["color"];
}

// The data table behind the chart, built lazily: a plain chart never fetches this module until it
// is read, shortly after the first paint.
export function snapshotOf(input: SnapshotInput): ChartSnapshot {
  const { texts, format, span, percent, critical, color } = input;
  const all = ganttRows(input.tasks);
  const names = new Map(input.tasks.map((task) => [task.id, task.name]));
  const column = (id: string, name: string, text: string[]) => ({
    id,
    name,
    color: color(0),
    values: text,
    text,
  });
  const series = [
    column(
      "start",
      texts.start,
      all.map((row) => format(row.start)),
    ),
    column(
      "end",
      texts.end,
      all.map((row) => format(input.displayEnd(row.start, row.end, input.timeZone))),
    ),
    column(
      "duration",
      texts.duration,
      all.map((row) => span(row.start, row.end)),
    ),
    column(
      "progress",
      texts.progress,
      all.map((row) =>
        row.task.milestone && !row.parent ? texts.milestone : percent(row.progress),
      ),
    ),
    column(
      "dependsOn",
      texts.dependsOn,
      all.map((row) => (row.task.dependencies ?? []).map((id) => names.get(id) ?? id).join(", ")),
    ),
  ];
  if (input.baselines)
    series.push(
      column(
        "baseline",
        texts.baseline,
        all.map((row) =>
          row.task.baseline
            ? `${format(+row.task.baseline.start)} - ${format(+row.task.baseline.end)}`
            : "",
        ),
      ),
    );
  if (critical)
    series.push(
      column(
        "critical",
        texts.criticalPath,
        all.map((row) => (critical.tasks.has(row.task.id) ? texts.critical : "")),
      ),
    );
  return {
    title: input.label ?? texts.tasks,
    categoryHeader: texts.tasks,
    categories: all.map((row) => `${"· ".repeat(row.depth)}${row.task.name}`),
    series,
    legend: [
      ...(critical
        ? [
            {
              id: "critical",
              name: texts.criticalPath,
              color: "var(--danger)",
              shape: "square" as const,
            },
          ]
        : []),
      ...(input.hasBaselineTasks
        ? [
            {
              id: "baseline",
              name: texts.baseline,
              color: "var(--ink-3)",
              shape: "square" as const,
            },
          ]
        : []),
    ],
  };
}
