# DataGrid

Pure logic lives in plain modules (tested in `test/data-grid*.test.mjs`); `data-grid.tsx` only wires it.

| Feature | Props | Logic |
| --- | --- | --- |
| Column types, validation | `type` (`boolean` added), `validate` | `model.ts` |
| Column groups | `column.group` (path) | `column-groups.ts` |
| Set filter | `filter: "set"` | `model.ts` (`toggleSetValues`) |
| Advanced filter | `advancedFilter`, `showAdvancedFilter`, `FilterBuilder` | `filter-builder.ts` |
| Tree data | `tree`, `expandedRowIds` | `tree.ts` |
| Master / detail | `renderDetail`, `detailHeight` | `rows.ts`, `virtual.ts` |
| Row pinning / reorder | `rowPinning`, `rowReorder` | `rows.ts` |
| Range selection | `rangeSelection` | `range.ts` |
| Server-side rows | `dataSource`, `pageSize`, `maxBlocks` | `data-source.ts`, `use-data-source.ts` |
| Pivot, tool panel | `pivot`, `toolPanel` | `pivot.ts`, `tool-panel.tsx` |
| CSV export | `exportFilename`, `onExport` | `model.ts` (`toCSV`) |
| Undo / redo | `history`, `historyDepth`, `onHistoryChange`, `onCellsChange`, `createRow`, `onRowsChange` | `history.ts` |
| Formulas | `formulas` | `formula.ts` (parser, evaluator), `formula-sheet.ts` (dependency graph, cycles) |
| XLSX export | `exportXlsx`, `onExportXlsx` | `xlsx-export.ts` + `src/xlsx` (`@jcsoftdev/ui/xlsx`: OOXML and ZIP writers, lazy loaded) |
| Integrated charts | `charts` (button in the range status bar) | `chart-range.ts`, `chart-panel.tsx` (lazy) |
| Sparkline column | `type: "sparkline"`, `sparkline` | `data-grid.tsx` (`Sparkline`) |
| Paste, fill | Ctrl + V, Ctrl + D / R (needs `onCellChange` or `onCellsChange`) | `grid-edit.ts` |
| Fill handle | square at the bottom-right of a range (`rangeSelection`, needs `onCellChange` or `onCellsChange`): drag down or right to extend; Ctrl on release copies only; Escape cancels | `fill-series.ts` (`handleExtent`, `fillLanes`, `seriesFill`) |

The fill handle continues linear numeric runs (1, 2, 3 or 10, 20), dates (daily, weekly, by month or year, month ends
kept) and text ending in a number ("Silla 1" gives "Silla 2", zero padding kept); a lone number or date, irregular
runs and plain text are copied, and formulas are copied with their relative references shifted (`shiftFormula`).
One drag is one history entry and one `onCellsChange` call with `source: "fill"`; the range grows to cover the fill.
It does not auto-scroll while dragging, and only extends down or right.

The grid never mutates `data`: edits, paste, fill, undo and redo are reported through
`onCellChange` (one change) or `onCellsChange` (several) with a `source`, and row changes through
`onRowsChange`; the parent applies them. Use a stable `getRowId` so history survives row changes.

Server-side mode sends sort, filters and quick search to `dataSource.getRows`; grouping, tree,
row pinning, pivot and detail rows are off there. Pivot and tree replace grouping.
Responsive behaviour uses container queries on `@container/grid` only.
