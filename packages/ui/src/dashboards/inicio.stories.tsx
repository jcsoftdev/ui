import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../atoms/button/index.js";
import { Chip } from "../atoms/chip/index.js";
import { AreaChart } from "../charts/area-chart/index.js";
import { BarChart } from "../charts/bar-chart/index.js";
import { DonutChart } from "../charts/donut-chart/index.js";
import { HeatmapChart } from "../charts/heatmap-chart/index.js";
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
import { BARBEROS, CLIENTES, SERVICIOS, seeded } from "./data.js";
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

const random = seeded(11);

const ingresos30 = Array.from({ length: 30 }, (_, index) => {
  const fecha = new Date(2026, 8, 9 + index);
  const finDeSemana = fecha.getDay() === 5 || fecha.getDay() === 6;
  const base = finDeSemana ? 1450 : 980;
  return { fecha, ingresos: Math.round(base + random() * 380) };
});

const ingresosPorServicio = [
  { id: "corte", name: "Corte clásico", value: 9800 },
  { id: "combo", name: "Corte + barba", value: 8450 },
  { id: "fade", name: "Fade degradado", value: 6200 },
  { id: "barba", name: "Perfilado de barba", value: 3100 },
  { id: "navaja", name: "Afeitado con navaja", value: 2400 },
  { id: "tinte", name: "Tinte de barba", value: 1650 },
];

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const HORAS = Array.from({ length: 12 }, (_, index) => `${9 + index}h`);
const ocupacion = DIAS.map((_, dia) =>
  HORAS.map((__, hora) => {
    const pico = dia >= 4 ? 1.15 : 0.85;
    const tarde = hora >= 7 && hora <= 10 ? 1.2 : hora === 3 ? 0.55 : 1;
    return Math.min(1, Math.round((45 + random() * 40) * pico * tarde) / 100);
  }),
);

const ventasPorBarbero = [
  { name: BARBEROS[0], total: 5820 },
  { name: BARBEROS[1], total: 5310 },
  { name: BARBEROS[2], total: 4680 },
  { name: BARBEROS[3], total: 3990 },
  { name: BARBEROS[4], total: 3230 },
].sort((a, b) => b.total - a.total);

interface Cita {
  id: string;
  hora: string;
  cliente: string;
  servicio: string;
  barbero: string;
  estado: "Confirmada" | "Pendiente" | "En sillón";
  total: number;
}

const ESTADOS: Cita["estado"][] = ["Confirmada", "Pendiente", "En sillón"];
const citas: Cita[] = Array.from({ length: 14 }, (_, index) => {
  const servicio = SERVICIOS[index % SERVICIOS.length] ?? SERVICIOS[0];
  const minutos = 10 * 60 + index * 35;
  return {
    id: `C-${2040 + index}`,
    hora: `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`,
    cliente: CLIENTES[index % CLIENTES.length] ?? "",
    servicio: servicio.name,
    barbero: BARBEROS[index % BARBEROS.length] ?? "",
    estado: ESTADOS[index % 3] ?? "Pendiente",
    total: servicio.price,
  };
});

const citaColumns: DataGridColumn<Cita>[] = [
  { id: "hora", header: "Hora", accessor: "hora", width: 84 },
  { id: "cliente", header: "Cliente", accessor: "cliente", width: 180 },
  { id: "servicio", header: "Servicio", accessor: "servicio", width: 170, filter: "select" },
  { id: "barbero", header: "Barbero", accessor: "barbero", width: 150, filter: "select" },
  {
    id: "estado",
    header: "Estado",
    accessor: "estado",
    type: "status",
    width: 130,
    statusTones: { Confirmada: "success", Pendiente: "warning", "En sillón": "accent" },
  },
  {
    id: "total",
    header: "Total",
    accessor: "total",
    type: "currency",
    aggregate: "sum",
    width: 100,
  },
];

function InicioDashboard() {
  return (
    <DashboardPage>
      <PageHeader>
        <div>
          <PageHeaderEyebrow>Barbería Don Lucho · Miraflores</PageHeaderEyebrow>
          <PageHeaderTitle>
            Buen día, <span className="text-accent-word">Lucho</span>
          </PageHeaderTitle>
          <PageHeaderLede>Así va tu barbería hoy, jueves 8 de octubre.</PageHeaderLede>
        </div>
        <PageHeaderActions>
          <Button variant="secondary" size="sm">
            Exportar
          </Button>
          <Button size="sm">Nueva cita</Button>
        </PageHeaderActions>
      </PageHeader>

      <KpiRow>
        <Kpi label="Ventas del día" value="S/ 1 280" description="+12% vs. ayer" />
        <Kpi label="Citas" value="18" suffix="/ 24" description="4 pendientes" />
        <Kpi label="Ticket promedio" value="S/ 47" description="Meta S/ 45" />
        <Kpi label="Ocupación" value="78%" description="Pico a las 17h" />
      </KpiRow>

      <Cols>
        <ChartCard
          title="Ingresos de los últimos 30 días"
          subtitle="Soles por día, con la meta diaria"
          aside={<Chip tone="success">+8% mensual</Chip>}
          height={320}
        >
          <AreaChart
            height="fill"
            title="Ingresos diarios de los últimos 30 días"
            categories={ingresos30.map((item) => item.fecha)}
            series={[
              { id: "ingresos", name: "Ingresos", data: ingresos30.map((item) => item.ingresos) },
            ]}
            valueFormat="currency"
            legend={false}
            annotations={[
              { type: "line", axis: "y", value: 1100, label: "Meta diaria", tone: "success" },
            ]}
            labels={{ empty: "Sin datos", category: "Día", value: "Ingresos" }}
          />
        </ChartCard>
        <ChartCard title="Ingresos por servicio" subtitle="Octubre, acumulado" height={320}>
          <DonutChart
            height="fill"
            title="Ingresos por servicio"
            data={ingresosPorServicio}
            valueFormat="currency"
            centerLabel="Total del mes"
            labels={{ total: "Total" }}
          />
        </ChartCard>
      </Cols>

      <CardGrid>
        <ChartCard
          title="Ocupación por hora y día"
          subtitle="Porcentaje de sillones ocupados"
          height={300}
        >
          <HeatmapChart
            height="fill"
            title="Ocupación por hora y día de la semana"
            rows={DIAS}
            columns={HORAS}
            values={ocupacion}
            domain={[0, 1]}
            valueFormat="percent"
            labels={{ category: "Día", value: "Ocupación", noData: "Sin datos" }}
          />
        </ChartCard>
        <ChartCard title="Ventas por barbero" subtitle="Octubre, en soles" height={300}>
          <BarChart
            height="fill"
            orientation="horizontal"
            title="Ventas por barbero"
            categories={ventasPorBarbero.map((item) => item.name ?? "")}
            series={[{ id: "ventas", name: "Ventas", data: ventasPorBarbero.map((i) => i.total) }]}
            valueFormat="currency"
            dataLabels
            legend={false}
          />
        </ChartCard>
      </CardGrid>

      <TableCard title="Próximas citas" subtitle="Hoy, desde las 10:00">
        <DataGrid
          aria-label="Próximas citas de hoy"
          data={citas}
          columns={citaColumns}
          getRowId={(cita) => cita.id}
          height={360}
          defaultPinned={{ left: ["hora"] }}
          exportFilename="proximas-citas"
        />
      </TableCard>
    </DashboardPage>
  );
}

const meta = {
  title: "Dashboards/Inicio",
  component: InicioDashboard,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Pantalla de inicio del dueño de la barbería: KPIs, ingresos de 30 días, mezcla de servicios, ocupación por hora, ventas por barbero y próximas citas. Todo se adapta al ancho del contenedor: usa la barra de herramientas Contenedor (320, 480, 768) o arrastra el marco.",
      },
    },
  },
} satisfies Meta<typeof InicioDashboard>;

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
