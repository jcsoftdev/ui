import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { AreaChart } from "../charts/area-chart/index.js";
import { DataGrid, type DataGridColumn } from "../containers/data-grid/index.js";
import { Kpi } from "../containers/kpi/index.js";
import { BARBEROS, seeded } from "./data.js";
import { InicioDashboard } from "./inicio-dashboard.js";
import { ChartCard, DashboardPage, KpiRow, TableCard } from "./layout.js";

type Preset = "soft" | "bordered" | "elevated" | "flat" | "glass" | "brutal";

const PRESETS: { id: Preset; name: string }[] = [
  { id: "soft", name: "Suave" },
  { id: "bordered", name: "Con bordes" },
  { id: "elevated", name: "Elevado" },
  { id: "flat", name: "Plano" },
  { id: "glass", name: "Vidrio" },
  { id: "brutal", name: "Brutal" },
];

interface ScopeProps {
  style?: Preset;
  density?: "compact" | "normal" | "comfortable";
  radius?: "none" | "sm" | "md" | "lg" | "full";
  children: ReactNode;
}

/** Scopes the attributes to a subtree; they work on any element, not only `<html>`. */
function Scope({ style, density, radius, children }: ScopeProps) {
  return (
    <div
      data-style={style}
      data-density={density}
      data-radius={radius}
      className="@container/page min-w-0 rounded-card bg-bg p-4 text-ink @min-[900px]/page:p-7"
      style={{ backgroundImage: "var(--page-backdrop)" }}
    >
      {children}
    </div>
  );
}

function Dashboard(props: Omit<ScopeProps, "children">) {
  return (
    <Scope {...props}>
      <InicioDashboard />
    </Scope>
  );
}

const random = seeded(23);
const semana = Array.from({ length: 14 }, (_, index) => ({
  fecha: new Date(2026, 8, 25 + index),
  ingresos: Math.round(900 + random() * 500),
}));

interface Barbero {
  id: string;
  nombre: string;
  citas: number;
  total: number;
}
const barberos: Barbero[] = BARBEROS.slice(0, 4).map((nombre, index) => ({
  id: `b${index}`,
  nombre,
  citas: 14 + ((index * 5) % 9),
  total: 2400 + index * 610,
}));
const barberoColumns: DataGridColumn<Barbero>[] = [
  { id: "nombre", header: "Barbero", accessor: "nombre", width: 150 },
  { id: "citas", header: "Citas", accessor: "citas", width: 80 },
  { id: "total", header: "Total", accessor: "total", type: "currency", width: 110 },
];

/** KPI row, one chart and a table snippet: the subset repeated in every gallery cell. */
function MiniDashboard() {
  return (
    <DashboardPage>
      <KpiRow>
        <Kpi label="Ventas del día" value="S/ 1 280" description="+12% vs. ayer" />
        <Kpi label="Citas" value="18" suffix="/ 24" description="4 pendientes" />
      </KpiRow>
      <ChartCard title="Ingresos" subtitle="Últimos 14 días" height={180}>
        <AreaChart
          height="fill"
          title="Ingresos de los últimos 14 días"
          categories={semana.map((item) => item.fecha)}
          series={[{ id: "ingresos", name: "Ingresos", data: semana.map((i) => i.ingresos) }]}
          valueFormat="currency"
          legend={false}
          animate={false}
          labels={{ empty: "Sin datos", category: "Día", value: "Ingresos" }}
        />
      </ChartCard>
      <TableCard title="Barberos" subtitle="Octubre">
        <DataGrid
          aria-label="Ventas por barbero"
          data={barberos}
          columns={barberoColumns}
          getRowId={(row) => row.id}
          height={200}
        />
      </TableCard>
    </DashboardPage>
  );
}

function Gallery() {
  return (
    <div className="@container/gallery min-w-0">
      <div className="grid grid-cols-1 gap-6 @min-[760px]/gallery:grid-cols-2 @min-[1180px]/gallery:grid-cols-3">
        {PRESETS.map(({ id, name }) => (
          <section key={id} aria-label={`Estilo ${name}`} className="flex min-w-0 flex-col gap-2">
            <h2 className="m-0 text-card-title text-ink">{name}</h2>
            <code className="select-all text-ink-3 text-meta">{`<html data-style="${id}">`}</code>
            <Scope style={id}>
              <MiniDashboard />
            </Scope>
          </section>
        ))}
      </div>
    </div>
  );
}

const meta = {
  title: "Dashboards/Presets",
  component: Dashboard,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "El mismo dashboard de Inicio, cambiado solo con atributos: cada historia envuelve la composición en un elemento con `data-style`, `data-density` o `data-radius`. No hay variantes de componentes ni contexto de React; los atributos solo reasignan variables CSS. Las historias Dark siguen la barra de herramientas Tema.",
      },
    },
  },
} satisfies Meta<typeof Dashboard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Soft: Story = { args: { style: "soft" } };
export const Bordered: Story = { args: { style: "bordered" } };
export const Elevated: Story = { args: { style: "elevated" } };
export const Flat: Story = { args: { style: "flat" } };
export const Glass: Story = { args: { style: "glass" } };
export const Brutal: Story = { args: { style: "brutal" } };

export const Compact: Story = { args: { style: "bordered", density: "compact" } };
export const RadiusNone: Story = { args: { style: "elevated", radius: "none" } };
export const RadiusFull: Story = { args: { style: "elevated", radius: "full" } };

export const GlassDark: Story = { args: { style: "glass" }, globals: { theme: "dark" } };
export const BrutalDark: Story = { args: { style: "brutal" }, globals: { theme: "dark" } };

/** Six cells, one per preset, in a container-query grid with the snippet to copy. */
export const PresetGallery: Story = {
  render: () => <Gallery />,
};
