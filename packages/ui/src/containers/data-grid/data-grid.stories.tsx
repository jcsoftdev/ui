import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo, useState } from "react";
import { expect, waitFor } from "storybook/test";
import type { IntentBridge } from "../../intent/index.js";
import { IntentBridgeProvider } from "../../intent/index.js";
import {
  ExpansionDemo,
  ExportDemo,
  FilterBuilderDemo,
  InfiniteScrollDemo,
  KeyboardDemo,
  MasterDetailDemo,
  PersistenceDemo,
  RemotePaginationDemo,
  RowPinningDemo,
  RowReorderDemo,
  TreeDemo,
  ValidationDemo,
} from "./data-grid.demos.js";
import {
  citaColumns,
  citas10k,
  citas240,
  inventario,
  type Producto,
  productoColumns,
  type Venta,
  ventaColumns,
  ventas,
} from "./data-grid.fixtures.js";
import { type CellChange, DataGrid, type DataGridProps } from "./data-grid.js";
import {
  catalogo,
  catalogoColumns,
  ventaGroupedColumns,
  ventaSetColumns,
  ventas240,
} from "./data-grid.samples.js";

// ---- meta --------------------------------------------------------------------------------

type ControlArgs = Pick<
  DataGridProps<Venta>,
  "density" | "selectable" | "loading" | "hideToolbar" | "height"
>;

function controls(args: ControlArgs): ControlArgs {
  const { density, selectable, loading, hideToolbar, height } = args;
  return { density, selectable, loading, hideToolbar, height };
}

const meta = {
  title: "Containers/DataGrid",
  component: DataGrid<Venta>,
  tags: ["autodocs"],
  args: {
    "aria-label": "Ventas de octubre",
    data: ventas,
    columns: ventaColumns,
    getRowId: (row) => row.id,
    selectable: true,
    loading: false,
    hideToolbar: false,
    height: 440,
    defaultPinned: { left: ["id"] },
  },
  argTypes: {
    data: { control: "object" },
    columns: { control: false },
    getRowId: { control: false },
    density: { control: "inline-radio", options: ["compact", "normal", "comfortable"] },
    selectable: { control: "boolean" },
    loading: { control: "boolean" },
    hideToolbar: { control: "boolean" },
    height: { control: { type: "number", min: 160, step: 40 } },
    onSortChange: { control: false },
    onFiltersChange: { control: false },
    onGroupByChange: { control: false },
    onDensityChange: { control: false },
    onSelectionChange: { control: false },
    onCellChange: { control: false },
    onCellsChange: { control: false },
    onHistoryChange: { control: false },
    createRow: { control: false },
    onRowsChange: { control: false },
    onExpandedRowsChange: { control: false },
    renderDetail: { control: false },
    onPinnedRowsChange: { control: false },
    onRowReorder: { control: false },
    onAdvancedFilterChange: { control: false },
    onPivotChange: { control: false },
    emptyMessage: { control: "text" },
    onExport: { control: false },
    onExportXlsx: { control: false },
    toolbarActions: { control: false },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Tabla de datos con orden múltiple (Mayús + clic), filtros por columna y búsqueda rápida, columnas fijables, redimensionables, reordenables y ocultables (persistidas con `storageKey`), selección de filas, agrupación con agregados, edición en línea, filas virtualizadas o paginación y exportación CSV. Navegación con teclado según el patrón ARIA grid.",
      },
    },
  },
} satisfies Meta<typeof DataGrid<Venta>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SortingFiltering: Story = {
  name: "Sorting / Filtering",
  args: {
    defaultSort: [
      { id: "barbero", direction: "asc" },
      { id: "total", direction: "desc" },
    ],
    defaultFilters: {
      estado: { kind: "select", values: ["Pagado", "Pendiente"] },
      total: { kind: "range", min: 30, max: null },
    },
  },
};

export const Pinning: Story = {
  render: (args) => (
    <DataGrid
      {...controls(args)}
      aria-label="Inventario de productos"
      data={inventario}
      columns={productoColumns}
      getRowId={(row) => row.sku}
      defaultPinned={{ left: ["producto"], right: ["valor"] }}
      storageKey="storybook:data-grid:inventario"
    />
  ),
};

export const Grouping: Story = {
  parameters: { a11y: { test: "todo" } },
  args: {
    defaultGroupBy: ["barbero"],
    defaultSort: [{ id: "fecha", direction: "desc" }],
  },
};

function EditingDemo(args: ControlArgs) {
  const [rows, setRows] = useState(inventario);
  const [last, setLast] = useState<CellChange<Producto> | null>(null);
  return (
    <div className="grid gap-2">
      <DataGrid
        {...controls(args)}
        aria-label="Inventario editable"
        data={rows}
        columns={productoColumns}
        getRowId={(row) => row.sku}
        defaultPinned={{ left: ["sku"] }}
        onCellChange={(change) => {
          setLast(change);
          setRows((previous) =>
            previous.map((row) =>
              row.sku === change.rowId ? { ...row, [change.columnId]: change.value } : row,
            ),
          );
        }}
      />
      <p className="text-[12.5px] text-ink-3" aria-live="polite">
        {last
          ? `Último cambio: ${last.rowId} · ${last.columnId}: ${String(last.previous)} → ${String(last.value)}`
          : "Doble clic, Enter o F2 para editar Producto, Categoría, Stock, Costo o Precio. Enter guarda, Escape cancela, Tab pasa a la siguiente celda editable."}
      </p>
    </div>
  );
}

export const Editing: Story = {
  args: { selectable: false },
  render: (args) => <EditingDemo {...controls(args)} />,
};

export const Virtualized10k: Story = {
  name: "Virtualized 10k",
  render: (args) => (
    <DataGrid
      {...controls(args)}
      aria-label="Citas del año"
      data={citas10k}
      columns={citaColumns}
      getRowId={(row) => row.id}
      defaultPinned={{ left: ["id"] }}
    />
  ),
};

export const Pagination: Story = {
  render: (args) => (
    <DataGrid
      {...controls(args)}
      aria-label="Citas de enero"
      data={citas240}
      columns={citaColumns}
      getRowId={(row) => row.id}
      pageSize={25}
      defaultPinned={{ left: ["id"] }}
    />
  ),
};

export const Narrow: Story = {
  name: "Narrow (320 px)",
  args: { defaultPinned: { left: ["id"], right: ["total"] } },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};

export const Dark: Story = {
  parameters: { a11y: { test: "todo" } },
  globals: { theme: "dark" },
  args: { defaultGroupBy: ["estado"] },
};

export const Loading: Story = {
  args: { loading: true },
};

export const Empty: Story = {
  args: { data: [] },
};

// ---- feature stories -----------------------------------------------------------------------

const narrow = (Story: () => React.JSX.Element) => (
  <div style={{ width: 320 }}>
    <Story />
  </div>
);

export const ColumnTypes: Story = {
  name: "Column types",
  render: (args) => (
    <DataGrid
      {...controls(args)}
      selectable={false}
      aria-label="Catálogo de servicios"
      data={catalogo}
      columns={catalogoColumns}
      getRowId={(row) => row.id}
      defaultPinned={{ left: ["nombre"] }}
    />
  ),
};

export const Validation: Story = {
  render: (args) => <ValidationDemo {...controls(args)} />,
};

export const ReorderResizeHide: Story = {
  name: "Reorder / resize / hide",
  render: (args) => (
    <DataGrid
      {...controls(args)}
      aria-label="Ventas con columnas ajustables"
      data={ventas}
      columns={ventaColumns}
      getRowId={(row) => row.id}
      defaultHidden={["propina"]}
    />
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Arrastra un encabezado para moverlo, tira del borde derecho para cambiar el ancho (doble clic lo restablece) y oculta columnas desde su menú o con el botón Columnas. Con el teclado: Mayús + Flechas cambia el ancho y Ctrl + Mayús + Flechas mueve la columna.",
      },
    },
  },
};

export const ColumnGroups: Story = {
  name: "Column groups",
  render: (args) => (
    <DataGrid
      {...controls(args)}
      aria-label="Ventas con encabezados agrupados"
      data={ventas}
      columns={ventaGroupedColumns}
      getRowId={(row) => row.id}
      defaultPinned={{ left: ["id"] }}
    />
  ),
};

export const ColumnGroupsNarrow: Story = {
  name: "Column groups (320 px)",
  decorators: [narrow],
  render: (args) => (
    <DataGrid
      {...controls(args)}
      aria-label="Ventas con encabezados agrupados"
      data={ventas}
      columns={ventaGroupedColumns}
      getRowId={(row) => row.id}
      defaultPinned={{ left: ["id"] }}
    />
  ),
};

export const RowPinning: Story = {
  name: "Row pinning",
  render: (args) => <RowPinningDemo {...controls(args)} />,
};

export const RowReorder: Story = {
  name: "Row reorder",
  render: (args) => <RowReorderDemo {...controls(args)} />,
};

export const RowExpansion: Story = {
  parameters: { a11y: { test: "todo" } },
  name: "Row expansion",
  render: (args) => <ExpansionDemo {...controls(args)} />,
};

export const StatePersistence: Story = {
  name: "State persistence",
  render: (args) => <PersistenceDemo {...controls(args)} />,
};

export const KeyboardNavigation: Story = {
  parameters: { a11y: { test: "todo" } },
  name: "Keyboard navigation",
  render: (args) => <KeyboardDemo {...controls(args)} />,
};

export const TreeData: Story = {
  parameters: { a11y: { test: "todo" } },
  name: "Tree data",
  render: (args) => <TreeDemo {...controls(args)} height={440} />,
};

export const RemotePagination: Story = {
  name: "Remote pagination",
  render: (args) => <RemotePaginationDemo {...controls(args)} />,
};

export const InfiniteScroll: Story = {
  name: "Infinite scroll",
  render: (args) => <InfiniteScrollDemo {...controls(args)} height={360} />,
};

export const SetFilter: Story = {
  name: "Set filter",
  render: (args) => (
    <DataGrid
      {...controls(args)}
      aria-label="Ventas con filtro de conjunto"
      data={ventas}
      columns={ventaSetColumns}
      getRowId={(row) => row.id}
      defaultFilters={{ barbero: { kind: "select", values: ["Ana", "Luis"] } }}
      defaultPinned={{ left: ["id"] }}
    />
  ),
};

export const FilterBuilder: Story = {
  name: "Filter builder",
  render: (args) => <FilterBuilderDemo {...controls(args)} />,
};

export const FilterBuilderToolbar: Story = {
  name: "Filter builder (toolbar)",
  render: (args) => (
    <DataGrid
      {...controls(args)}
      aria-label="Ventas con filtro avanzado"
      data={ventas}
      columns={ventaColumns}
      getRowId={(row) => row.id}
      showAdvancedFilter
      defaultPinned={{ left: ["id"] }}
    />
  ),
};

export const FilterBuilderNarrow: Story = {
  name: "Filter builder (320 px)",
  decorators: [narrow],
  render: (args) => <FilterBuilderDemo {...controls(args)} />,
};

export const RangeSelection: Story = {
  name: "Range selection",
  render: (args) => (
    <DataGrid
      {...controls(args)}
      selectable={false}
      aria-label="Ventas con selección de celdas"
      data={ventas}
      columns={ventaColumns}
      getRowId={(row) => row.id}
      rangeSelection
      defaultPinned={{ left: ["id"] }}
    />
  ),
};

export const RangeSelectionNarrow: Story = {
  name: "Range selection (320 px)",
  decorators: [narrow],
  render: (args) => (
    <DataGrid
      {...controls(args)}
      selectable={false}
      aria-label="Ventas con selección de celdas"
      data={ventas}
      columns={ventaColumns}
      getRowId={(row) => row.id}
      rangeSelection
      defaultPinned={{ left: ["id"] }}
    />
  ),
};

export const Pivot: Story = {
  render: (args) => (
    <DataGrid
      {...controls(args)}
      selectable={false}
      aria-label="Tabla dinámica de ventas"
      data={ventas240}
      columns={ventaColumns}
      getRowId={(row) => row.id}
      toolPanel
      defaultPivot={{
        enabled: true,
        rows: ["barbero"],
        column: "servicio",
        value: "total",
        aggregate: "sum",
      }}
    />
  ),
};

export const MasterDetail: Story = {
  parameters: { a11y: { test: "todo" } },
  name: "Master / detail",
  render: (args) => <MasterDetailDemo {...controls(args)} height={520} />,
};

export const ToolPanel: Story = {
  name: "Tool panel",
  render: (args) => (
    <DataGrid
      {...controls(args)}
      selectable={false}
      aria-label="Ventas con panel de columnas"
      data={ventas240}
      columns={ventaColumns}
      getRowId={(row) => row.id}
      toolPanel
      defaultToolPanelOpen
      defaultPinned={{ left: ["id"] }}
    />
  ),
};

export const ToolPanelNarrow: Story = {
  name: "Tool panel (320 px)",
  decorators: [narrow],
  render: (args) => (
    <DataGrid
      {...controls(args)}
      selectable={false}
      aria-label="Ventas con panel de columnas"
      data={ventas240}
      columns={ventaColumns}
      getRowId={(row) => row.id}
      toolPanel
      defaultToolPanelOpen
    />
  ),
};

export const ExportCsv: Story = {
  name: "Export CSV",
  render: (args) => <ExportDemo {...controls(args)} />,
};

interface IntentRow {
  id: string;
  name: string;
  total: number;
}

const intentRows: IntentRow[] = Array.from({ length: 1000 }, (_, index) => ({
  id: `order-${index + 1}`,
  name: `Order ${index + 1}`,
  total: (index % 97) + 10,
}));

const intentColumns = [
  { id: "name", header: "Order", accessor: "name" as const },
  { id: "total", header: "Total", accessor: "total" as const, type: "number" as const },
];

function createRecordingBridge() {
  const counts = new Map<string, number>();
  let probe: HTMLElement | null = null;
  let peak = 0;
  const publish = () => {
    const live = [...counts.values()].reduce((sum, value) => sum + value, 0);
    peak = Math.max(peak, live);
    probe?.setAttribute("data-live", String(live));
    probe?.setAttribute("data-peak", String(peak));
  };
  const bridge: IntentBridge = {
    registerTarget(ref) {
      const key = `${ref.intent}:${ref.key}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      publish();
      return () => {
        const next = (counts.get(key) ?? 1) - 1;
        if (next === 0) counts.delete(key);
        else counts.set(key, next);
        publish();
      };
    },
  };
  const attachProbe = (node: HTMLElement | null) => {
    probe = node;
    publish();
  };
  return { bridge, attachProbe };
}

function RowIntentsDemo() {
  const { bridge, attachProbe } = useMemo(createRecordingBridge, []);
  return (
    <IntentBridgeProvider bridge={bridge}>
      <div ref={attachProbe} data-probe="">
        <DataGrid<IntentRow>
          aria-label="Orders with row intents"
          data={intentRows}
          columns={intentColumns}
          getRowId={(row) => row.id}
          rowIntent="order-row"
          height={320}
          hideToolbar
        />
      </div>
    </IntentBridgeProvider>
  );
}

export const RowIntents: Story = {
  render: () => <RowIntentsDemo />,
  play: async ({ canvasElement }) => {
    const probe = canvasElement.querySelector<HTMLElement>("[data-probe]");
    const mounted = () => canvasElement.querySelectorAll("tr[data-row-id]").length;
    const live = () => Number(probe?.getAttribute("data-live") ?? "0");
    await waitFor(() => expect(mounted()).toBeGreaterThan(0));
    await waitFor(() => expect(live()).toBe(mounted()));
    const scroller = canvasElement.querySelector<HTMLElement>(".overflow-auto");
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
    await waitFor(() =>
      expect(canvasElement.querySelector('tr[data-row-id="order-1000"]')).not.toBeNull(),
    );
    await waitFor(() => expect(live()).toBe(mounted()));
    const peak = Number(probe?.getAttribute("data-peak") ?? "0");
    await expect(peak).toBeLessThanOrEqual(mounted() * 2);
  },
};
