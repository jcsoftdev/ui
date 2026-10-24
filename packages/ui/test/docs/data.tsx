// Type-checks the examples in site/src/content/docs/docs/data-and-dashboards.md against the built package.
// Every ```tsx block in that page must equal one `#region` below (see test/docs-examples.mjs).
import {
  CardGrid,
  ChartCard,
  DashboardPage,
  FilterBar,
  Kpi,
  KpiRow,
  Page,
  Pagination,
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableColumnsMenu,
  TableEmpty,
  TableHead,
  TableHeaderCell,
  TableLoading,
  TableRow,
  type TableSort,
} from "@jcsoftdev/ui/containers";
import { BarChart } from "@jcsoftdev/ui/charts";
import { type ReactElement, useState } from "react";

interface Row {
  id: string;
  name: string;
  stock: number;
}
declare const rows: Row[];
declare const total: number;
declare const loading: boolean;
declare function PaymentsTable(): ReactElement;
declare function sortRows(rows: Row[], sort: TableSort | null): Row[];

// #region dashboard
export function Home() {
  return (
    <Page>
      <DashboardPage>
        <KpiRow aria-label="Key figures">
          <Kpi label="Enrolled" value="1,240" />
          <Kpi label="Collected" value="86%" />
          <Kpi label="Overdue" value="$18,400" />
          <Kpi label="Attendance" value="94%" />
        </KpiRow>
        <CardGrid columns={2}>
          <ChartCard title="Collected per month" height={260}>
            <BarChart
              height="fill"
              title="Collected per month"
              categories={["Jan", "Feb", "Mar"]}
              series={[{ id: "paid", name: "Paid", data: [42, 51, 47] }]}
            />
          </ChartCard>
          <TableCard title="Latest payments">
            <PaymentsTable />
          </TableCard>
        </CardGrid>
      </DashboardPage>
    </Page>
  );
}
// #endregion

// #region sortable
export function Products() {
  const [sort, setSort] = useState<TableSort | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  return (
    <>
      <TableColumnsMenu
        columns={[
          { id: "name", label: "Name" },
          { id: "stock", label: "Stock" },
        ]}
        hiddenColumns={hidden}
        onHiddenColumnsChange={setHidden}
      />
      <Table aria-label="Products" sort={sort} onSortChange={setSort} hiddenColumns={hidden}>
        <TableHead>
          <tr>
            <TableHeaderCell columnId="name" sortable>
              Name
            </TableHeaderCell>
            <TableHeaderCell columnId="stock" alignRight sortable>
              Stock
            </TableHeaderCell>
          </tr>
        </TableHead>
        <TableBody>
          {loading ? (
            <TableLoading columns={2} />
          ) : rows.length === 0 ? (
            <TableEmpty colSpan={2} />
          ) : (
            sortRows(rows, sort).map((row) => (
              <TableRow key={row.id}>
                <TableCell columnId="name">{row.name}</TableCell>
                <TableCell columnId="stock" alignRight>
                  {row.stock}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </>
  );
}
// #endregion

// #region pagination
export function PagedFooter() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  return (
    <Pagination
      total={total}
      page={page}
      onPageChange={setPage}
      pageSize={pageSize}
      onPageSizeChange={setPageSize}
    />
  );
}
// #endregion

// #region filter-bar
export function Filters() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  return (
    <FilterBar
      search={search}
      onSearchChange={setSearch}
      quickFilters={{
        label: "Status",
        options: [
          { value: "open", label: "Open" },
          { value: "overdue", label: "Overdue" },
        ],
        value: status,
        onValueChange: setStatus,
      }}
      activeFilters={
        status ? [{ id: "status", label: `Status: ${status}`, onRemove: () => setStatus("") }] : []
      }
      onClearAll={() => {
        setSearch("");
        setStatus("");
      }}
      resultCount={total}
    />
  );
}
// #endregion
