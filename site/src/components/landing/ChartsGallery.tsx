import {
  BarChart,
  DonutChart,
  FunnelChart,
  GaugeChart,
  HeatmapChart,
  LineChart,
  PolarAreaChart,
  RadarChart,
  ScatterChart,
  SunburstChart,
  TreemapChart,
  WaterfallChart,
} from "@jcsoftdev/ui/charts";
import type { ReactNode } from "react";
import { useMounted } from "./bento";
import { BARBEROS, ingresos, seeded, serviciosIngreso } from "./data";

const semana = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const horas = ["10", "12", "14", "16", "18"];
const rnd = seeded(5);
const calor = semana.map(() => horas.map(() => Math.round(rnd() * 30)));
const dispersion = Array.from({ length: 36 }, () => {
  const duracion = Math.round(15 + rnd() * 55);
  return { x: duracion, y: Math.round(10 + duracion * 0.8 + (rnd() - 0.5) * 24) };
});

const ventas = {
  name: "Ventas",
  children: [
    {
      name: "Cortes",
      children: [
        { name: "Clásico", value: 6480 },
        { name: "Degradado", value: 5320 },
        { name: "Infantil", value: 1890 },
      ],
    },
    {
      name: "Barba",
      children: [
        { name: "Perfilado", value: 2960 },
        { name: "Afeitado", value: 1740 },
      ],
    },
    {
      name: "Productos",
      children: [
        { name: "Cera", value: 1480 },
        { name: "Pomada", value: 1120 },
      ],
    },
    { name: "Color", children: [{ name: "Tinte", value: 1650 }] },
  ],
};

function Cell({ name, children }: { name: string; children: ReactNode }) {
  return (
    <figure className="m-0 flex min-w-0 flex-col gap-1 rounded-card border-card p-card shadow-card surface-card">
      <figcaption className="text-ink-3 text-meta font-semibold uppercase tracking-wider">
        {name}
      </figcaption>
      <div className="h-56 min-w-0">{children}</div>
    </figure>
  );
}

const labels = { empty: "Sin datos", category: "Día", value: "Valor" };

/** Small multiples of real charts; each one fills its cell exactly. */
export default function ChartsGallery() {
  const mounted = useMounted();
  if (!mounted) return <div className="h-[34rem]" aria-hidden="true" />;
  return (
    <div className="grid gap-density sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <Cell name="Line">
        <LineChart
          height="fill"
          title="Ingresos diarios"
          categories={ingresos.slice(-14).map((i) => i.fecha)}
          series={[{ id: "i", name: "Ingresos", data: ingresos.slice(-14).map((i) => i.ingresos) }]}
          legend={false}
          valueFormat="currency"
          labels={labels}
        />
      </Cell>
      <Cell name="Bar">
        <BarChart
          height="fill"
          title="Citas por día"
          categories={semana}
          series={[{ id: "c", name: "Citas", data: [18, 24, 27, 33, 46, 58, 12] }]}
          legend={false}
          labels={labels}
        />
      </Cell>
      <Cell name="Donut">
        <DonutChart
          height="fill"
          title="Ingresos por servicio"
          data={serviciosIngreso}
          valueFormat="currency"
          legend={false}
          labels={{ total: "Total" }}
        />
      </Cell>
      <Cell name="Radar">
        <RadarChart
          height="fill"
          title="Evaluación del equipo"
          axes={["Corte", "Degradado", "Barba", "Trato", "Puntualidad"]}
          series={BARBEROS.slice(0, 2).map((name, index) => ({
            id: name,
            name,
            data: [92 - index * 12, 70 + index * 18, 80, 85 - index * 10, 78 + index * 9],
          }))}
          valueFormat="integer"
        />
      </Cell>
      <Cell name="Gauge">
        <GaugeChart
          height="fill"
          title="Ocupación de sillas"
          label="Ocupación"
          value={78}
          ranges={[
            { from: 0, to: 40, label: "Baja", tone: "danger" },
            { from: 40, to: 70, label: "Media", tone: "warning" },
            { from: 70, to: 100, label: "Óptima", tone: "success" },
          ]}
          valueFormat={(v: number) => `${Math.round(v)}%`}
        />
      </Cell>
      <Cell name="Funnel">
        <FunnelChart
          height="fill"
          title="De la visita a la reserva"
          stages={[
            { id: "v", name: "Visitas", value: 1200 },
            { id: "i", name: "Interesados", value: 640 },
            { id: "r", name: "Reservas", value: 310 },
            { id: "a", name: "Atendidos", value: 268 },
          ]}
          valueFormat="integer"
        />
      </Cell>
      <Cell name="Waterfall">
        <WaterfallChart
          height="fill"
          title="De ingresos a utilidad"
          steps={[
            { label: "Ingresos", value: 9800, type: "start" },
            { label: "Sueldos", value: -4200 },
            { label: "Local", value: -1800 },
            { label: "Insumos", value: -900 },
            { label: "Propinas", value: 640 },
            { label: "Utilidad", type: "total" },
          ]}
          valueFormat="currency"
          legend={false}
        />
      </Cell>
      <Cell name="Heatmap">
        <HeatmapChart
          height="fill"
          title="Citas por día y hora"
          rows={semana}
          columns={horas}
          values={calor}
          valueFormat="integer"
          legend={false}
        />
      </Cell>
      <Cell name="Scatter">
        <ScatterChart
          height="fill"
          title="Duración vs. ticket"
          series={[{ id: "s", name: "Atenciones", points: dispersion }]}
          xFormat={(v: number) => `${Math.round(v)} min`}
          yFormat="currency"
        />
      </Cell>
      <Cell name="Treemap">
        <TreemapChart
          height="fill"
          title="Ventas por categoría"
          data={ventas}
          valueFormat="currency"
          depth={2}
          legend={false}
        />
      </Cell>
      <Cell name="Sunburst">
        <SunburstChart
          height="fill"
          title="Ventas por categoría y servicio"
          data={ventas}
          valueFormat="currency"
          levels={2}
          legend={false}
        />
      </Cell>
      <Cell name="Polar area">
        <PolarAreaChart
          height="fill"
          title="Citas por día"
          data={semana.map((name, index) => ({
            id: name,
            name,
            value: [18, 24, 27, 33, 46, 58, 12][index] ?? 0,
          }))}
          valueFormat="integer"
        />
      </Cell>
    </div>
  );
}
