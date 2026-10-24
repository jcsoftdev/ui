import { renderToStaticMarkup } from "react-dom/server";
import { CardGrid, ChartCard, KpiRow, TableCard } from "../../src/containers/dashboard/dashboard.js";
import { FilterBar } from "../../src/containers/filter-bar/filter-bar.js";
import { Pagination } from "../../src/containers/pagination/pagination.js";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "../../src/containers/table/table.js";
import { TableEmpty, TableLoading } from "../../src/containers/table/table-parts.js";
import { UiStringsProvider } from "../../src/i18n/index.js";

function sample(props: Record<string, unknown>) {
  return (
    <Table aria-label="Products" {...props}>
      <TableHead>
        <tr>
          <TableHeaderCell columnId="name" sortable>
            Name
          </TableHeaderCell>
          <TableHeaderCell columnId="stock" sortable>
            Stock
          </TableHeaderCell>
        </tr>
      </TableHead>
      <TableBody>
        <TableRow>
          <TableCell columnId="name">Pomade</TableCell>
          <TableCell columnId="stock">24</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

export const html = {
  sorted: () =>
    renderToStaticMarkup(sample({ sort: { columnId: "stock", direction: "descending" } })),
  noSortProps: () => renderToStaticMarkup(sample({})),
  hiddenStock: () => renderToStaticMarkup(sample({ hiddenColumns: ["stock"] })),
  empty: () =>
    renderToStaticMarkup(
      <table>
        <tbody>
          <TableEmpty colSpan={3} />
        </tbody>
      </table>,
    ),
  loading: () =>
    renderToStaticMarkup(
      <table>
        <tbody>
          <TableLoading columns={2} rows={3} />
        </tbody>
      </table>,
    ),
  pagination: () => renderToStaticMarkup(<Pagination total={134} defaultPage={2} />),
  paginationEs: () =>
    renderToStaticMarkup(
      <UiStringsProvider locale="es">
        <Pagination total={1340} page={3} pageSize={25} />
      </UiStringsProvider>,
    ),
  filterBar: () =>
    renderToStaticMarkup(
      <FilterBar
        quickFilters={{ options: [{ value: "a", label: "A" }], value: "a" }}
        activeFilters={[{ id: "a", label: "Status: A", onRemove: () => {} }]}
        onClearAll={() => {}}
        resultCount={1240}
      >
        <input aria-label="Extra" />
      </FilterBar>,
    ),
  filterBarOne: () => renderToStaticMarkup(<FilterBar resultCount={1} />),
  filterBarEmpty: () => renderToStaticMarkup(<FilterBar />),
  dashboard: () =>
    renderToStaticMarkup(
      <>
        <KpiRow aria-label="Key figures">x</KpiRow>
        <CardGrid columns={3}>x</CardGrid>
        <ChartCard title="Revenue" headingLevel={3}>
          x
        </ChartCard>
        <TableCard title="Payments">x</TableCard>
      </>,
    ),
};
