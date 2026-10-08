import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../atoms/button/index.js";
import { Chip } from "../atoms/chip/index.js";
import { LineChart } from "../charts/line-chart/index.js";
import { SankeyChart } from "../charts/sankey-chart/index.js";
import { WaterfallChart } from "../charts/waterfall-chart/index.js";
import { Cols } from "../containers/cols/index.js";
import { DataGrid, type DataGridColumn } from "../containers/data-grid/index.js";
import { Kpi } from "../containers/kpi/index.js";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderEyebrow,
  PageHeaderLede,
  PageHeaderTitle,
} from "../containers/page-header/index.js";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "../containers/table/index.js";
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

const caja = [
  { id: "apertura", label: "Apertura", value: 200, type: "start" as const },
  { id: "efectivo", label: "Efectivo", value: 620 },
  { id: "yape", label: "Yape", value: 480 },
  { id: "plin", label: "Plin", value: 210 },
  { id: "tarjeta", label: "Tarjeta", value: 390 },
  { id: "propinas", label: "Propinas", value: 85 },
  { id: "insumos", label: "Insumos", value: -180 },
  { id: "adelantos", label: "Adelantos", value: -250 },
  { id: "servicios", label: "Servicios", value: -95 },
  { id: "cierre", label: "Cierre", type: "total" as const },
];

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Set", "Oct", "Nov", "Dic"];
const random = seeded(23);
const ingresos2025 = MESES.map((_, index) => Math.round(21000 + index * 700 + random() * 2600));
const ingresos2026 = MESES.map((_, index) =>
  index < 10 ? Math.round((ingresos2025[index] ?? 0) * (1.06 + random() * 0.1)) : null,
);

const flujoNodos = [
  { id: "web", name: "Reserva web" },
  { id: "walkin", name: "Sin cita" },
  { id: "recurrente", name: "Recurrente" },
  { id: "corte", name: "Cortes" },
  { id: "barba", name: "Barba" },
  { id: "combo", name: "Combos" },
  { id: "efectivo", name: "Efectivo" },
  { id: "yape", name: "Yape / Plin" },
  { id: "tarjeta", name: "Tarjeta" },
];
const flujoEnlaces = [
  { source: "web", target: "corte", value: 3200 },
  { source: "web", target: "combo", value: 2900 },
  { source: "walkin", target: "corte", value: 2600 },
  { source: "walkin", target: "barba", value: 1100 },
  { source: "recurrente", target: "combo", value: 3600 },
  { source: "recurrente", target: "barba", value: 900 },
  { source: "corte", target: "efectivo", value: 2400 },
  { source: "corte", target: "yape", value: 2800 },
  { source: "corte", target: "tarjeta", value: 600 },
  { source: "barba", target: "efectivo", value: 900 },
  { source: "barba", target: "yape", value: 1100 },
  { source: "combo", target: "efectivo", value: 1500 },
  { source: "combo", target: "yape", value: 2700 },
  { source: "combo", target: "tarjeta", value: 2300 },
];

interface Egreso {
  id: string;
  fecha: Date;
  concepto: string;
  categoria: string;
  proveedor: string;
  metodo: string;
  monto: number;
  estado: "Pagado" | "Pendiente";
}

const egresos: Egreso[] = [
  ["Pomada y ceras", "Insumos", "Distribuidora Andina", "Transferencia", 640, "Pagado"],
  ["Navajas desechables", "Insumos", "Distribuidora Andina", "Yape", 180, "Pagado"],
  ["Alquiler del local", "Fijos", "Inmobiliaria Barranco", "Transferencia", 2800, "Pagado"],
  ["Luz y agua", "Servicios", "Luz del Sur", "Tarjeta", 310, "Pendiente"],
  ["Internet", "Servicios", "Movistar", "Tarjeta", 129, "Pagado"],
  ["Adelanto Marco Rojas", "Planilla", "Marco Rojas", "Efectivo", 250, "Pagado"],
  ["Adelanto Ana Torres", "Planilla", "Ana Torres", "Efectivo", 300, "Pagado"],
  ["Toallas y capas", "Insumos", "Textiles Gamarra", "Efectivo", 420, "Pendiente"],
  ["Publicidad en redes", "Marketing", "Meta", "Tarjeta", 350, "Pagado"],
  ["Mantenimiento de sillones", "Fijos", "Taller Quispe", "Yape", 220, "Pendiente"],
].map(([concepto, categoria, proveedor, metodo, monto, estado], index) => ({
  id: `E-${300 + index}`,
  fecha: new Date(2026, 9, 1 + index),
  concepto: String(concepto),
  categoria: String(categoria),
  proveedor: String(proveedor),
  metodo: String(metodo),
  monto: Number(monto),
  estado: estado as Egreso["estado"],
}));

const egresoColumns: DataGridColumn<Egreso>[] = [
  { id: "fecha", header: "Fecha", accessor: "fecha", type: "date", width: 116 },
  { id: "concepto", header: "Concepto", accessor: "concepto", width: 210 },
  { id: "categoria", header: "Categoría", accessor: "categoria", width: 130, groupable: true },
  { id: "proveedor", header: "Proveedor", accessor: "proveedor", width: 190 },
  { id: "metodo", header: "Método", accessor: "metodo", width: 130, filter: "select" },
  {
    id: "monto",
    header: "Monto",
    accessor: "monto",
    type: "currency",
    aggregate: "sum",
    width: 120,
  },
  {
    id: "estado",
    header: "Estado",
    accessor: "estado",
    type: "status",
    width: 120,
    statusTones: { Pagado: "success", Pendiente: "warning" },
  },
];

const cierrePorMedio = [
  { medio: "Efectivo", ventas: 620, comision: 0 },
  { medio: "Yape / Plin", ventas: 690, comision: 0 },
  { medio: "Tarjeta", ventas: 390, comision: 14 },
];

function FinanzasDashboard() {
  return (
    <DashboardPage>
      <PageHeader>
        <div>
          <PageHeaderEyebrow>Finanzas · Octubre 2026</PageHeaderEyebrow>
          <PageHeaderTitle>
            Caja e <span className="text-accent-word">ingresos</span>
          </PageHeaderTitle>
          <PageHeaderLede>
            Cómo se movió el dinero hoy y cómo va el año contra el anterior.
          </PageHeaderLede>
        </div>
        <PageHeaderActions>
          <Button variant="secondary" size="sm">
            Cerrar caja
          </Button>
          <Button size="sm">Registrar egreso</Button>
        </PageHeaderActions>
      </PageHeader>

      <KpiRow>
        <Kpi label="Ingresos del mes" value="S/ 29 600" description="+9% vs. setiembre" />
        <Kpi label="Egresos del mes" value="S/ 5 599" description="19% de los ingresos" />
        <Kpi label="Utilidad" value="S/ 24 001" description="Margen 81%" />
        <Kpi label="Por pagar" value="S/ 950" variant="danger" description="3 pendientes" />
      </KpiRow>

      <Cols variant="half">
        <ChartCard
          title="Caja del día"
          subtitle="De la apertura al cierre, en soles"
          aside={<Chip tone="success">Cuadrada</Chip>}
          height={320}
        >
          <WaterfallChart
            height="fill"
            title="Movimientos de la caja del día"
            steps={caja}
            valueFormat="currency"
            increaseLabel="Ingreso"
            decreaseLabel="Egreso"
            totalLabel="Total"
            runningLabel="Acumulado"
          />
        </ChartCard>
        <ChartCard
          title="Ingresos mensuales"
          subtitle="2026 contra 2025"
          aside={<Chip tone="accent">+11% acumulado</Chip>}
          height={320}
        >
          <LineChart
            height="fill"
            title="Ingresos mensuales 2026 contra 2025"
            categories={MESES}
            series={[
              { id: "y2026", name: "2026", data: ingresos2026 },
              { id: "y2025", name: "2025", data: ingresos2025, dashed: true },
            ]}
            valueFormat="currency"
            markers
          />
        </ChartCard>
      </Cols>

      <ChartCard
        title="Origen, servicio y medio de pago"
        subtitle="Por dónde entra el dinero y cómo se cobra"
        height={380}
      >
        <SankeyChart
          height="fill"
          title="Flujo de ingresos: origen, servicio y medio de pago"
          nodes={flujoNodos}
          links={flujoEnlaces}
          columns={["Origen", "Servicio", "Medio de pago"]}
          valueFormat="currency"
        />
      </ChartCard>

      <CardGrid>
        <TableCard title="Cierre por medio de pago" subtitle="Hoy">
          <div className="overflow-x-auto">
            <Table aria-label="Cierre de caja por medio de pago">
              <TableHead>
                <tr>
                  <TableHeaderCell>Medio</TableHeaderCell>
                  <TableHeaderCell alignRight>Ventas</TableHeaderCell>
                  <TableHeaderCell alignRight>Comisión</TableHeaderCell>
                </tr>
              </TableHead>
              <TableBody>
                {cierrePorMedio.map((fila) => (
                  <TableRow key={fila.medio}>
                    <TableCell>{fila.medio}</TableCell>
                    <TableCell alignRight>S/ {fila.ventas}</TableCell>
                    <TableCell alignRight>S/ {fila.comision}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TableCard>
        <TableCard title="Pendientes de pago" subtitle="Egresos por cancelar">
          <div className="flex flex-wrap gap-2 px-4 py-3.5">
            {egresos
              .filter((egreso) => egreso.estado === "Pendiente")
              .map((egreso) => (
                <Chip key={egreso.id} tone="warning">
                  {egreso.concepto} · S/ {egreso.monto}
                </Chip>
              ))}
          </div>
        </TableCard>
      </CardGrid>

      <TableCard title="Egresos del mes" subtitle="Agrupa por categoría desde el menú de la tabla">
        <DataGrid
          aria-label="Egresos del mes"
          data={egresos}
          columns={egresoColumns}
          getRowId={(egreso) => egreso.id}
          height={360}
          defaultPinned={{ left: ["fecha"] }}
          exportFilename="egresos"
        />
      </TableCard>
    </DashboardPage>
  );
}

const meta = {
  title: "Dashboards/Finanzas",
  component: FinanzasDashboard,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Finanzas de la barbería: cascada de la caja del día, ingresos mensuales contra el año anterior, Sankey origen > servicio > medio de pago y egresos en una tabla con totales. Usa la barra Contenedor (320, 480, 768) para ver cómo se reacomoda.",
      },
    },
  },
} satisfies Meta<typeof FinanzasDashboard>;

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
