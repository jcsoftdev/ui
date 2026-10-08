import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../atoms/button/index.js";
import { BoxPlot } from "../charts/box-plot/index.js";
import { FillGaugeChart } from "../charts/fill-gauge-chart/index.js";
import { Histogram } from "../charts/histogram/index.js";
import { TreemapChart } from "../charts/treemap-chart/index.js";
import { DataGrid, type DataGridColumn } from "../containers/data-grid/index.js";
import { Kpi } from "../containers/kpi/index.js";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderEyebrow,
  PageHeaderLede,
  PageHeaderTitle,
} from "../containers/page-header/index.js";
import { seeded } from "./data.js";
import {
  CardGrid,
  ChartCard,
  DashboardPage,
  KpiRow,
  NARROW_NOTE,
  narrowFrame,
  TABLET_NOTE,
  TableCard,
  tabletFrame,
} from "./layout.js";

interface Producto {
  sku: string;
  producto: string;
  categoria: string;
  proveedor: string;
  stock: number;
  minimo: number;
  costo: number;
  precio: number;
  rotacion: number;
  estado: "Normal" | "Bajo" | "Agotado";
}

const CATALOGO: [string, string, string, number, number, number, number][] = [
  ["POM-001", "Pomada mate Hombre Fuerte", "Pomadas", 24, 10, 22, 38],
  ["POM-002", "Pomada brillo clásica", "Pomadas", 9, 10, 20, 35],
  ["CER-014", "Cera de fijación media", "Pomadas", 17, 8, 18, 32],
  ["ACE-007", "Aceite para barba", "Barba", 31, 12, 26, 45],
  ["BAL-004", "Bálsamo para barba", "Barba", 14, 8, 24, 42],
  ["SHA-021", "Shampoo para barba", "Barba", 17, 10, 17, 30],
  ["NAV-003", "Navajas desechables (caja)", "Descartables", 4, 10, 14, 28],
  ["CAP-011", "Capas de corte", "Descartables", 40, 15, 6, 12],
  ["TOA-009", "Toallas calientes", "Descartables", 0, 12, 4, 9],
  ["TIN-002", "Tinte negro natural", "Color", 12, 6, 28, 48],
  ["TIN-005", "Tinte castaño", "Color", 6, 6, 28, 48],
  ["MAQ-001", "Máquina de corte Pro", "Equipos", 3, 2, 260, 390],
  ["MAQ-004", "Patillera inalámbrica", "Equipos", 5, 2, 180, 280],
];

const random = seeded(31);
const productos: Producto[] = CATALOGO.map(
  ([sku, producto, categoria, stock, minimo, costo, precio], index) => ({
    sku,
    producto,
    categoria,
    proveedor: index % 2 === 0 ? "Distribuidora Andina" : "Barber Supply Perú",
    stock,
    minimo,
    costo,
    precio,
    rotacion: Math.round(8 + random() * 40),
    estado: stock === 0 ? "Agotado" : stock < minimo ? "Bajo" : "Normal",
  }),
);

const porCategoria = Object.entries(
  productos.reduce<Record<string, { name: string; value: number }[]>>((acc, item) => {
    const lista = acc[item.categoria] ?? [];
    lista.push({ name: item.producto, value: item.stock * item.costo });
    acc[item.categoria] = lista;
    return acc;
  }, {}),
).map(([name, children]) => ({ name, children: children.filter((child) => child.value > 0) }));

const niveles = productos
  .filter((item) => item.categoria !== "Equipos")
  .slice(0, 8)
  .map((item) => ({
    id: item.sku,
    name: item.producto.replace(/ \(caja\)/, ""),
    value: Math.min(100, Math.round((item.stock / (item.minimo * 2.5)) * 100)),
  }));

const categorias = [...new Set(productos.map((item) => item.categoria))];
const rotacionPorCategoria = categorias.map((categoria) =>
  Array.from({ length: 24 }, () => {
    const base = categoria === "Descartables" ? 30 : categoria === "Equipos" ? 8 : 18;
    return Math.round(base + (random() - 0.5) * 20 + (random() > 0.93 ? 25 : 0));
  }),
);
const rotacionTodos = rotacionPorCategoria.flat();

const columns: DataGridColumn<Producto>[] = [
  { id: "sku", header: "SKU", accessor: "sku", width: 100, hideable: false },
  { id: "producto", header: "Producto", accessor: "producto", width: 240 },
  {
    id: "categoria",
    header: "Categoría",
    accessor: "categoria",
    width: 140,
    groupable: true,
    filter: "select",
  },
  { id: "proveedor", header: "Proveedor", accessor: "proveedor", width: 190 },
  { id: "stock", header: "Stock", accessor: "stock", type: "number", aggregate: "sum", width: 90 },
  { id: "minimo", header: "Mínimo", accessor: "minimo", type: "number", width: 90 },
  { id: "costo", header: "Costo", accessor: "costo", type: "currency", width: 100 },
  { id: "precio", header: "Precio", accessor: "precio", type: "currency", width: 100 },
  { id: "rotacion", header: "Rotación (días)", accessor: "rotacion", type: "number", width: 140 },
  {
    id: "estado",
    header: "Estado",
    accessor: "estado",
    type: "status",
    width: 120,
    filter: "select",
    statusTones: { Normal: "success", Bajo: "warning", Agotado: "danger" },
  },
];

function InventarioDashboard() {
  return (
    <DashboardPage>
      <PageHeader>
        <div>
          <PageHeaderEyebrow>Inventario · Sede Miraflores</PageHeaderEyebrow>
          <PageHeaderTitle>
            Stock y <span className="text-accent-word">rotación</span>
          </PageHeaderTitle>
          <PageHeaderLede>Qué tienes, qué se acaba y qué tarda en venderse.</PageHeaderLede>
        </div>
        <PageHeaderActions>
          <Button variant="secondary" size="sm">
            Importar
          </Button>
          <Button size="sm">Pedir a proveedor</Button>
        </PageHeaderActions>
      </PageHeader>

      <KpiRow>
        <Kpi label="Productos" value="13" description="5 categorías" />
        <Kpi label="Valor en stock" value="S/ 4 862" description="A costo" />
        <Kpi label="Stock bajo" value="4" suffix="/ 13" variant="danger" description="1 agotado" />
        <Kpi label="Rotación media" value="21 días" description="-3 vs. setiembre" />
      </KpiRow>

      <CardGrid>
        <ChartCard
          title="Nivel de productos"
          subtitle="Porcentaje sobre el stock ideal"
          height={340}
        >
          <FillGaugeChart
            height="fill"
            title="Nivel de stock por producto"
            data={niveles}
            shape="bottle"
            max={100}
            minItemWidth={120}
          />
        </ChartCard>
        <ChartCard title="Valor por categoría" subtitle="Stock a costo, en soles" height={340}>
          <TreemapChart
            height="fill"
            title="Valor del inventario por categoría"
            data={{ name: "Inventario", children: porCategoria }}
            valueFormat="currency"
          />
        </ChartCard>
      </CardGrid>

      <CardGrid>
        <ChartCard
          title="Rotación por categoría"
          subtitle="Días hasta vender el stock"
          height={300}
        >
          <BoxPlot
            height="fill"
            title="Rotación en días por categoría"
            categories={categorias}
            series={[
              {
                id: "rotacion",
                name: "Rotación",
                data: rotacionPorCategoria,
              },
            ]}
            valueFormat="integer"
            showMean
          />
        </ChartCard>
        <ChartCard title="Distribución de la rotación" subtitle="Todos los productos" height={300}>
          <Histogram
            height="fill"
            title="Distribución de la rotación en días"
            series={[{ id: "rotacion", name: "Productos", values: rotacionTodos }]}
            bins={10}
            valueFormat="integer"
          />
        </ChartCard>
      </CardGrid>

      <TableCard
        title="Productos"
        subtitle="SKU y producto quedan fijos al desplazarte; el estado queda fijo a la derecha"
      >
        <DataGrid
          aria-label="Inventario de productos"
          data={productos}
          columns={columns}
          getRowId={(producto) => producto.sku}
          height={380}
          defaultPinned={{ left: ["sku", "producto"], right: ["estado"] }}
          exportFilename="inventario"
        />
      </TableCard>
    </DashboardPage>
  );
}

const meta = {
  title: "Dashboards/Inventario",
  component: InventarioDashboard,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Inventario de la barbería: KPIs de stock, niveles con gauges de botella, valor por categoría en treemap, rotación en diagrama de cajas e histograma y una grilla con columnas fijadas. Usa la barra Contenedor para revisar 320, 480 y 768.",
      },
    },
  },
} satisfies Meta<typeof InventarioDashboard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Narrow: Story = {
  decorators: [narrowFrame],
  parameters: { docs: { description: { story: NARROW_NOTE } } },
};

export const Tablet: Story = {
  decorators: [tabletFrame],
  parameters: { docs: { description: { story: TABLET_NOTE } } },
};
