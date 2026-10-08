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
| Paste, fill | Ctrl + V, Ctrl + D / R (needs `onCellChange` or `onCellsChange`) | `grid-edit.ts` |

The grid never mutates `data`: edits, paste, fill, undo and redo are reported through
`onCellChange` (one change) or `onCellsChange` (several) with a `source`, and row changes through
`onRowsChange`; the parent applies them. Use a stable `getRowId` so history survives row changes.

Server-side mode sends sort, filters and quick search to `dataSource.getRows`; grouping, tree,
row pinning, pivot and detail rows are off there. Pivot and tree replace grouping.
Responsive behaviour uses container queries on `@container/grid` only.
