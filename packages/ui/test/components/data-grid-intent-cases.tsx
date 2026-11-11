import { renderToStaticMarkup } from "react-dom/server";
import { DataGrid } from "../../src/containers/data-grid/data-grid.js";

interface Order {
  id: string;
  customer: string;
  group: string;
  total: number;
}

const rows: Order[] = [
  { id: "a", customer: "Ana", group: "north", total: 10 },
  { id: "b", customer: "Beto", group: "south", total: 20 },
  { id: "c", customer: "Cesar", group: "north", total: 30 },
];

const columns = [
  { id: "customer", header: "Customer", accessor: "customer" as const },
  { id: "total", header: "Total", accessor: "total" as const, type: "number" as const },
];

const getRowId = (row: Order) => row.id;

export const gridHtml = (props: Record<string, unknown> = {}) =>
  renderToStaticMarkup(
    <DataGrid<Order>
      aria-label="Orders"
      data={rows}
      columns={columns}
      getRowId={getRowId}
      hideToolbar
      {...props}
    />,
  );

export const gridWithoutRowIds = (props: Record<string, unknown> = {}) =>
  renderToStaticMarkup(
    <DataGrid<Order> aria-label="Orders" data={rows} columns={columns} hideToolbar {...props} />,
  );

export const loadingGridHtml = () => gridHtml({ loading: true });

export const detailGridHtml = () =>
  gridHtml({ renderDetail: (row: Order) => <p>{row.customer}</p>, defaultExpandedRowIds: ["a"] });

export const groupedGridHtml = () =>
  gridHtml({
    columns: [...columns, { id: "group", header: "Group", accessor: "group" as const, groupable: true }],
    groupBy: ["group"],
  });
