import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useMemo, useState } from "react";
import { AreaChart } from "../area-chart/area-chart.js";
import { ChartSyncProvider } from "../core/cartesian/sync.js";
import type { HierarchyDatum } from "../core/hierarchy.js";
import { LineChart } from "./line-chart.js";
import { LineDrilldown } from "./line-drilldown.js";

/** Daily sales (S/) for a barbershop: Saturdays peak, Sundays only open half a day. */
function dailySales(days: number, from: Date, seed = 0) {
  const dates = Array.from(
    { length: days },
    (_, i) => new Date(from.getFullYear(), from.getMonth(), from.getDate() + i),
  );
  const values = dates.map((date, i) => {
    const weekday = date.getDay();
    const bump = weekday === 6 ? 620 : weekday === 5 ? 280 : weekday === 0 ? -540 : 0;
    return Math.round(1180 + 210 * Math.sin((i + seed) / 2.6) + bump + i * 6 + seed * 35);
  });
  return { dates, values };
}

const twoWeeks = dailySales(14, new Date(2026, 8, 28));
const lastPeriod = dailySales(14, new Date(2026, 8, 14), 3);
const quarter = dailySales(92, new Date(2026, 6, 1));

const spanishLabels = {
  empty: "Sin ventas registradas en este periodo",
  loading: "Cargando gráfico",
  resetZoom: "Ver todo",
  total: "Total",
  explore: "Puntos del gráfico. Usa las flechas para recorrerlos.",
  brush: "Rango visible",
  category: "Día",
};

const meta = {
  title: "Charts/LineChart",
  component: LineChart,
  tags: ["autodocs"],
  args: {
    title: "Ventas por día",
    categories: twoWeeks.dates,
    series: [{ id: "ventas", name: "Ventas", data: twoWeeks.values }],
    valueFormat: "currency",
    height: 300,
    curve: "smooth",
    markers: false,
    dataLabels: false,
    grid: true,
    tooltip: true,
    brush: false,
    loading: false,
    animate: true,
    labels: spanishLabels,
  },
  argTypes: {
    curve: {
      control: "inline-radio",
      options: ["smooth", "linear", "step", "step-before", "step-after"],
    },
    valueFormat: {
      control: "select",
      options: ["number", "integer", "currency", "percent", "compact"],
    },
    xScale: { control: "inline-radio", options: ["auto", "band", "time"] },
    legend: { control: "select", options: [true, false, "top", "bottom"] },
    height: { control: { type: "range", min: 160, max: 520, step: 10 } },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 760, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LineChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Straight: Story = {
  args: { curve: "linear", markers: true },
};

export const ComparedWithLastPeriod: Story = {
  name: "Compared with last period (dashed)",
  args: {
    title: "Ventas: estas dos semanas frente a las anteriores",
    series: [
      { id: "actual", name: "Estas 2 semanas", data: twoWeeks.values },
      { id: "anterior", name: "2 semanas antes", data: lastPeriod.values, dashed: true },
    ],
  },
};

export const DataLabels: Story = {
  args: {
    title: "Ventas de la semana",
    categories: twoWeeks.dates.slice(0, 7),
    series: [{ id: "ventas", name: "Ventas", data: twoWeeks.values.slice(0, 7) }],
    markers: true,
    dataLabels: true,
    valueFormat: "currency",
    yAxis: { format: "compact" },
  },
};

export const GoalAndHoliday: Story = {
  name: "Annotations (goal and holiday)",
  args: {
    annotations: [
      { type: "line", axis: "y", value: 1500, label: "Meta diaria S/ 1 500", tone: "success" },
      {
        type: "range",
        axis: "x",
        from: new Date(2026, 9, 8),
        to: new Date(2026, 9, 8),
        label: "Feriado",
        tone: "warning",
      },
    ],
  },
};

export const BrushZoom: Story = {
  name: "Brush and zoom (92 days)",
  args: {
    title: "Ventas por día, tercer trimestre",
    categories: quarter.dates,
    series: [{ id: "ventas", name: "Ventas", data: quarter.values }],
    brush: true,
  },
};

export const WithGaps: Story = {
  args: {
    title: "Ventas con días sin registro",
    series: [
      {
        id: "ventas",
        name: "Ventas",
        data: twoWeeks.values.map((value, i) => (i === 5 || i === 6 ? null : value)),
      },
    ],
    markers: true,
  },
};

/** Prices and stock hold their value until something changes: the step keeps that honest. */
export const Step: Story = {
  args: {
    title: "Pomada en inventario",
    categories: twoWeeks.dates,
    series: [
      {
        id: "stock",
        name: "Pomada (unidades)",
        data: [48, 48, 41, 41, 33, 96, 90, 90, 84, 77, 77, 70, 62, 62],
      },
      { id: "reserva", name: "Mínimo recomendado", data: Array(14).fill(35), dashed: true },
    ],
    curve: "step-after",
    valueFormat: "integer",
    markers: true,
  },
};

const best = twoWeeks.values.indexOf(Math.max(...twoWeeks.values));

export const Annotated: Story = {
  name: "Annotated (lines, bands, markers, text)",
  args: {
    title: "Ventas con eventos del mes",
    annotations: [
      { type: "line", axis: "y", value: 1500, label: "Meta diaria", tone: "success" },
      { type: "range", axis: "y", from: 0, to: 900, label: "Zona baja", tone: "danger" },
      {
        type: "range",
        axis: "x",
        from: twoWeeks.dates[3] as Date,
        to: twoWeeks.dates[5] as Date,
        label: "Promo 2x1",
        tone: "accent",
      },
      {
        type: "line",
        axis: "x",
        value: twoWeeks.dates[9] as Date,
        label: "Feriado",
        tone: "warning",
      },
      {
        type: "point",
        x: twoWeeks.dates[best] as Date,
        y: twoWeeks.values[best] as number,
        label: "Récord",
        tooltip: "Mejor día del periodo: 38 servicios y la agenda llena desde las 9:00.",
        tone: "success",
      },
      {
        type: "text",
        x: twoWeeks.dates[12] as Date,
        y: (twoWeeks.values[12] as number) + 260,
        label: "Domingo corto",
        tooltip: "Solo se atiende hasta el mediodía.",
      },
    ],
  },
};

export const Gradient: Story = {
  args: {
    title: "Ventas con línea en degradado",
    gradient: true,
    series: [
      { id: "actual", name: "Estas 2 semanas", data: twoWeeks.values },
      { id: "anterior", name: "2 semanas antes", data: lastPeriod.values },
    ],
  },
};

/** Three charts share one `syncId`: hover any of them and all show the same day; drag-zoom the first and the rest follow. */
export const SyncedCharts: Story = {
  parameters: { layout: "padded" },
  render: (args) => {
    const days = quarter.dates;
    const cuts = days.map((_, i) => Math.round((quarter.values[i] as number) / 38));
    const tips = days.map((_, i) => Math.round((quarter.values[i] as number) * 0.09));
    return (
      <ChartSyncProvider>
        <div style={{ display: "grid", gap: 8 }}>
          <LineChart
            {...args}
            syncId="trimestre"
            title="Ventas por día"
            categories={days}
            series={[{ id: "ventas", name: "Ventas", data: quarter.values }]}
            brush
            height={180}
          />
          <AreaChart
            {...args}
            syncId="trimestre"
            title="Servicios realizados"
            categories={days}
            series={[{ id: "servicios", name: "Servicios", data: cuts }]}
            valueFormat="integer"
            height={150}
          />
          <LineChart
            {...args}
            syncId="trimestre"
            title="Propinas"
            categories={days}
            series={[{ id: "propinas", name: "Propinas", data: tips, color: "var(--chart-cat-3)" }]}
            curve="step"
            height={150}
          />
        </div>
      </ChartSyncProvider>
    );
  },
};

const clock = (date: Date) =>
  `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;

const WINDOW = 40;

function LiveSales(args: Parameters<typeof LineChart>[0]) {
  const [paused, setPaused] = useState(false);
  const [points, setPoints] = useState(() => {
    const now = Date.now();
    return Array.from({ length: WINDOW }, (_, i) => ({
      at: new Date(now - (WINDOW - 1 - i) * 1500),
      value: 60 + Math.round(18 * Math.sin(i / 4)),
    }));
  });
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setPoints((current) => {
        const last = current[current.length - 1];
        const drift = Math.round((Math.random() - 0.5) * 16);
        const value = Math.max(20, Math.min(120, (last?.value ?? 60) + drift));
        return [...current.slice(1), { at: new Date(), value }];
      });
    }, 1500);
    return () => clearInterval(id);
  }, [paused]);
  const categories = useMemo(() => points.map((point) => point.at), [points]);
  const series = useMemo(
    () => [{ id: "live", name: "S/ por minuto", data: points.map((point) => point.value) }],
    [points],
  );
  return (
    <div onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}>
      <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--ink-3)" }}>
        {paused
          ? "En pausa mientras miras el gráfico"
          : "Entran ventas cada 1,5 s; pasa el puntero para pausar"}
      </p>
      <LineChart
        {...args}
        title="Ventas en vivo"
        categories={categories}
        series={series}
        xScale="band"
        xFormat={(value) => clock(value as Date)}
        yAxis={{ min: 0, max: 140 }}
        transition
        animate={false}
        markers={false}
        legend={false}
      />
    </div>
  );
}

/** Sliding window of 40 points: each new sale pushes the oldest out and the line glides to its new shape. */
export const LiveAppend: Story = {
  render: (args) => <LiveSales {...args} />,
};

const MINUTES = 100_000;
const bigStart = new Date(2026, 0, 1).getTime();
const bigDates = Array.from({ length: MINUTES }, (_, i) => new Date(bigStart + i * 60_000));
const bigValues = (() => {
  let noise = 0;
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  return Array.from({ length: MINUTES }, (_, i) => {
    const hour = ((i % 1440) / 60) | 0;
    const open = hour >= 9 && hour < 20 ? 1 : 0.15;
    noise = noise * 0.98 + (random() - 0.5) * 0.6;
    return Math.max(
      0,
      Math.round((4 + 5 * Math.sin(((i % 1440) / 1440) * Math.PI * 2) ** 2) * open + noise),
    );
  });
})();

/** 100 000 per-minute samples (70 days). Above `maxPoints` (2 000) the line is reduced with LTTB; drag to zoom and it resamples the window. */
export const Downsampled100k: Story = {
  name: "Downsampled (100k points)",
  args: {
    title: "Personas en el local por minuto, 70 días",
    categories: bigDates,
    series: [{ id: "aforo", name: "Personas", data: bigValues }],
    valueFormat: "integer",
    curve: "linear",
    brush: true,
    animate: false,
    maxPoints: 2000,
  },
};

function quarterTree(): HierarchyDatum {
  const months = [
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
  ];
  return {
    name: "2026",
    children: [0, 1, 2, 3].map((q) => ({
      name: `T${q + 1}`,
      children: months.slice(q * 3, q * 3 + 3).map((month, m) => ({
        name: month,
        children: [1, 2, 3, 4].map((week) => ({
          name: `Sem ${week}`,
          value: 4200 + ((q * 3 + m) % 5) * 380 + week * 210 + ((week * (m + 2) * 97) % 700),
        })),
      })),
    })),
  };
}

/** Click a point (or focus the plot and press Enter) to open its breakdown; the breadcrumb climbs back out. */
export const Drilldown: Story = {
  render: (args) => (
    <LineDrilldown
      {...args}
      data={quarterTree()}
      title="Ventas 2026 por periodo"
      seriesName="Ventas"
      breadcrumbLabel="Ruta del detalle"
      curve="smooth"
      markers
      valueFormat="currency"
    />
  ),
};

export const DrilldownNarrow: Story = {
  ...Drilldown,
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};

export const Loading: Story = { args: { loading: true } };

export const Empty: Story = {
  args: { series: [{ id: "ventas", name: "Ventas", data: [] }], categories: [] },
};

/** Drag the corner: the chart fills the box exactly, width and height. */
export const FillParent: Story = {
  args: { height: "fill" },
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div
        style={{
          width: 560,
          height: 360,
          resize: "both",
          overflow: "hidden",
          outline: "1px dashed var(--line-strong)",
        }}
      >
        <Story />
      </div>
    ),
  ],
};

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};
