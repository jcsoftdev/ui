---
title: Data and dashboards
description: DashboardPage, KpiRow, CardGrid, ChartCard and TableCard, sortable Table headers with empty and loading rows, a standalone Pagination and a FilterBar, with container-query behavior, accessibility notes and examples.
section: Guides
---

Blocks for the screens that show figures and lists: a dashboard page, a table you can sort and page, and a bar to filter it. All of them import from `@jcsoftdev/ui/containers`, take their texts from `UiStringsProvider` (en/es), use tokens only and answer to the width of their container, never the viewport. Each one also has a generated page under Components.

Every example below is type-checked against the built package (`pnpm check:docs-examples`).

## Dashboard blocks

`DashboardPage` sets the vertical rhythm, `KpiRow` joins the KPI tiles (two per row, four from 720 px of container), `CardGrid` lays out equal cards (`columns` 2 or 3, stacking under 720 px) and `ChartCard` and `TableCard` frame a chart or a table. Put them inside `Page`: their grids read the `page` container.

```tsx region=dashboard
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
```

Accessibility: `KpiRow` is a `group` (name it with `aria-label`), and each card is a `section` named by its title, so screen reader users can jump between them by landmark. `headingLevel` (2 to 4) keeps the outline right when the dashboard sits under other headings. A `ChartCard` body has a fixed `height`; the chart inside uses `height="fill"`.

## Sortable tables

Mark a header `sortable` (with a `columnId`) and give the `Table` a `sort` state. The header becomes a button that cycles ascending, descending, off, and the `th` reports `aria-sort`. The table only reports the state: sort your rows, or send `sort` to your API. `TableEmpty` and `TableLoading` are rows for the no-result and first-load states, and `hiddenColumns` drops columns by `columnId` (`TableColumnsMenu` is the checkbox picker, which keeps one column visible).

```tsx region=sortable
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
```

### Row density and sticky actions

Every body row has a minimum height, so a row of text and a row holding a 30px button measure the
same: `density="comfortable"` (default) is 48px and `"compact"` 40px, with cells centred vertically.
Both set CSS variables on the table (`--row-min-h`, `--table-cell-py`) that `className` or `style` can
override. `stickyActions` keeps the last column, the row actions, on the right edge while the other
columns scroll under it; it engages from 24rem of the table's own width, so a phone-width table
scrolls it along.

```tsx region=density
export function LongList() {
  return (
    <Table aria-label="Stock" density="compact" stickyActions>
      <TableHead>
        <tr>
          <TableHeaderCell>Name</TableHeaderCell>
          <TableHeaderCell alignRight>Stock</TableHeaderCell>
          <TableHeaderCell>
            <span className="sr-only">Actions</span>
          </TableHeaderCell>
        </tr>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>{row.name}</TableCell>
            <TableCell alignRight>{row.stock}</TableCell>
            <TableActionsCell>
              <Button size="sm">Restock</Button>
            </TableActionsCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

### Row actions

`RowActions` puts at most one inline action in a row and the rest in an overflow menu behind a
30px "more" button. `label` names that button (name the row: "Actions for Ana Quispe"). Items are
`{ id, label, onSelect, icon?, tone?, disabled? }`; `tone: "danger"` items sort last, behind a
separator. The actions never wrap, and neither a click nor a key inside them (menu included)
reaches the row, so a clickable row does not also activate. Put it in a `TableActionsCell`.

```tsx region=row-actions
export function PersonActions({ person }: { person: Person }) {
  return (
    <RowActions
      label={`Actions for ${person.name}`}
      primary={<Button size="sm">Open</Button>}
      items={[
        { id: "edit", label: "Edit", onSelect: () => edit(person) },
        { id: "delete", label: "Delete", tone: "danger", onSelect: () => remove(person) },
      ]}
    />
  );
}
```

## Pagination

A footer for any list: rows per page, the range ("11–20 of 134") and first, previous, next and last buttons. Pages are 1-based. It does not slice your rows; use `page` and `pageSize` to do that or to request the page. Changing the page size returns to page 1. `DataGrid` keeps its own built-in footer.

```tsx region=pagination
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
```

### Page numbers, client-side paging and cursors

`variant="pages"` swaps the icon buttons for Previous, page numbers (with gaps on long lists) and
Next, and reads the range as "Showing 1–25 of 134". It renders nothing while every row fits on one
page (`hideOnSinglePage`) and shows the page size picker only when you pass `pageSizeOptions`.
`usePagination(rows, resetKey, pageSize)` slices a client-side list: the page is clamped when the
list shrinks and returns to 1 whenever `resetKey` (the search, a filter) changes.

```tsx region=pagination-pages
export function StudentList({ students, query }: { students: Row[]; query: string }) {
  const pager = usePagination(students, query, 25);
  return (
    <>
      <ul>
        {pager.items.map((student) => (
          <li key={student.id}>{student.name}</li>
        ))}
      </ul>
      <Pagination
        variant="pages"
        total={pager.total}
        pageSize={pager.pageSize}
        page={pager.page}
        onPageChange={pager.setPage}
      />
    </>
  );
}
```

`CursorPagination` is for server-side cursor paging, where the total is unknown: it shows the range
on screen ("Showing 26–50") and Previous / Next, and renders nothing on a first page without a next
cursor. Keep the cursor trail yourself; it only reports the clicks. Strings come from
`UiStringsProvider` (Spanish: "Mostrando 26–50", "Anterior", "Siguiente").

```tsx region=cursor-pagination
export function ServerList() {
  const [page, setPage] = useState(1);
  return (
    <CursorPagination
      page={page}
      count={rows.length}
      hasNext={hasNextCursor}
      onPrevious={() => setPage(page - 1)}
      onNext={() => setPage(page + 1)}
    />
  );
}
```

## FilterBar

Search, single-choice quick chips (`quickFilters`), a "More filters" popover (its `children`), the applied filters as removable chips (`activeFilters`) with "Clear all" (`onClearAll`) and a polite result count. Under 40 rem of its own container width the quick chips and the extra filters fold into one "Filters" button and only the search stays inline. The bar keeps no filter state besides the search text: you own the filters and apply them to your rows.

```tsx region=filter-bar
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
```

Each active chip's remove button is named "Remove filter {label}" and the count is announced with `role="status"`. Pass `labels` to override any text.
