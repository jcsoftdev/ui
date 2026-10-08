export interface ChartDataTableProps {
  caption: string;
  /** Header of the first column. */
  categoryHeader: string;
  /** Row headers, already formatted. */
  categories: readonly string[];
  columns: ReadonlyArray<{ id: string; name: string; values: ReadonlyArray<string> }>;
}

/**
 * Visually hidden table with the same numbers as the chart, so the data is
 * reachable by screen readers (and by copy/paste) without relying on color.
 */
export function ChartDataTable({
  caption,
  categoryHeader,
  categories,
  columns,
}: ChartDataTableProps) {
  return (
    // The wrapper clips: a table ignores `width: 1px`, so a wide one would still overflow the page.
    <div className="sr-only">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{categoryHeader}</th>
            {columns.map((column) => (
              <th key={column.id} scope="col">
                {column.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {categories.map((category, row) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: categories can repeat; rows follow the data order.
            <tr key={row}>
              <th scope="row">{category}</th>
              {columns.map((column) => (
                <td key={column.id}>{column.values[row] ?? ""}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
