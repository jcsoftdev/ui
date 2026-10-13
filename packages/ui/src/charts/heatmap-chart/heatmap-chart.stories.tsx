import type { Meta, StoryObj } from "@storybook/react-vite";
import { CalendarHeatmap } from "./calendar-heatmap.js";
import type { CalendarDay } from "./calendar-layout.js";
import { DrilldownHeatmap, type HeatmapLevel } from "./drilldown-heatmap.js";
import { HeatmapChart } from "./heatmap-chart.js";

const days = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
const hours = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
];

/** Ocupación (%) de sillas por día y hora: picos a mediodía y después del trabajo, sábado lleno. */
const occupancy: number[][] = days.map((_, day) =>
  hours.map((_, hour) => {
    const weekend = day === 5 ? 28 : day === 6 ? -22 : 0;
    const lunch = hour === 3 || hour === 4 ? 18 : 0;
    const evening = hour >= 8 && hour <= 10 ? 30 : 0;
    const morning = hour < 2 ? -18 : 0;
    const wobble = ((day * 7 + hour * 13) % 11) - 5;
    return Math.max(0, Math.min(100, 42 + weekend + lunch + evening + morning + wobble));
  }),
);

const average =
  occupancy.flat().reduce((sum, value) => sum + value, 0) / (days.length * hours.length);
const versusAverage = occupancy.map((row) => row.map((value) => Math.round(value - average)));

const withGaps = occupancy.map((row, day) =>
  row.map((value, hour) => (day === 6 && hour > 7 ? null : value)),
);

const percent = (value: number) => `${Math.round(value)}%`;
const signed = (value: number) => `${value > 0 ? "+" : ""}${Math.round(value)} pts`;

function seeded(index: number): number {
  const x = Math.sin(index * 12.9898) * 43_758.5453;
  return x - Math.floor(x);
}

/** Citas por día desde abril hasta el 8 de octubre de 2026; los domingos se atiende medio día. */
const appointmentsByDay: CalendarDay[] = Array.from({ length: 191 }, (_, index) => {
  const date = new Date(2026, 3, 1 + index);
  const weekday = (date.getDay() + 6) % 7;
  const base = weekday === 5 ? 16 : weekday === 6 ? 4 : 9;
  const closed = date.getMonth() === 6 && date.getDate() === 28;
  return {
    date,
    value: closed ? null : Math.round(base + seeded(index) * 7 - (weekday === 0 ? 3 : 0)),
  };
});

const spanishLabels = {
  empty: "Sin datos para este periodo",
  loading: "Cargando mapa de calor",
  resetZoom: "Ver todo",
  total: "Total",
  explore: "Celdas del mapa de calor. Usa las flechas para moverte por filas y columnas.",
  brush: "Rango visible",
  category: "Día",
  noData: "Sin datos",
};

const meta = {
  title: "Charts/HeatmapChart",
  component: HeatmapChart,
  tags: ["autodocs"],
  args: {
    title: "Ocupación de sillas por hora y día",
    rows: days,
    columns: hours,
    values: occupancy,
    scale: "sequential",
    valueFormat: percent,
    domain: [0, 100],
    cellLabels: false,
    gap: 3,
    radius: 4,
    legend: true,
    tooltip: true,
    animate: true,
    loading: false,
    labels: spanishLabels,
  },
  argTypes: {
    scale: { control: "inline-radio", options: ["sequential", "diverging"] },
    gap: { control: { type: "range", min: 0, max: 8, step: 1 } },
    radius: { control: { type: "range", min: 0, max: 12, step: 1 } },
    height: { control: { type: "range", min: 140, max: 520, step: 10 } },
    rows: { control: false },
    columns: { control: false },
    values: { control: false },
    valueFormat: { control: false },
    shape: { control: "inline-radio", options: ["rect", "hex"] },
    renderer: { control: "inline-radio", options: ["svg", "canvas"] },
    ranges: { control: false },
    colors: { control: false },
    onCellClick: { control: false },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 820, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HeatmapChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** A second measure of the same cell in the tooltip. */
export const CellDetail: Story = {
  args: {
    cellDetail: (row, column, value) =>
      value == null
        ? []
        : [
            {
              id: "count",
              name: "Citas",
              value: `${Math.round(value / 8) + ((row + column) % 3)}`,
              color: "transparent",
            },
          ],
  },
};

export const CellLabels: Story = {
  args: { cellLabels: true, height: 300 },
};

export const Diverging: Story = {
  args: {
    title: "Ocupación frente al promedio semanal",
    values: versusAverage,
    scale: "diverging",
    domain: undefined,
    center: 0,
    valueFormat: signed,
    cellLabels: true,
    height: 300,
  },
};

export const Ranges: Story = {
  args: {
    title: "Nivel de ocupación por hora",
    cellLabels: true,
    height: 300,
    ranges: [
      { to: 35, label: "Baja (menos de 35%)", tone: "neutral" },
      { from: 35, to: 60, label: "Media", tone: "success" },
      { from: 60, to: 80, label: "Alta", tone: "warning" },
      { from: 80, label: "Llena (80% o más)", tone: "danger" },
    ],
  },
};

export const MissingData: Story = {
  args: {
    title: "Ocupación con el domingo cerrado desde las 17:00",
    values: withGaps,
  },
};

export const Calendar: Story = {
  render: (args) => (
    <CalendarHeatmap
      title="Citas por día"
      days={appointmentsByDay}
      valueFormat="integer"
      animate={args.animate}
      tooltip={args.tooltip}
      loading={args.loading}
      labels={{ ...spanishLabels, category: "Fecha" }}
    />
  ),
};

export const CalendarRanges: Story = {
  render: (args) => (
    <CalendarHeatmap
      title="Citas por día"
      days={appointmentsByDay}
      valueFormat="integer"
      ranges={[
        { from: 0, to: 5, label: "0-4 citas" },
        { from: 5, to: 10, label: "5-9" },
        { from: 10, to: 15, label: "10-14" },
        { from: 15, label: "15 o más" },
      ]}
      animate={args.animate}
      labels={{ ...spanishLabels, category: "Fecha" }}
    />
  ),
};

export const Rounded: Story = {
  args: {
    title: "Ocupación en celdas redondeadas",
    gap: 5,
    radius: 12,
    cellLabels: true,
    height: 320,
  },
};

/** Pointy-top hexagons; odd rows sit half a cell to the right. */
export const Honeycomb: Story = {
  args: {
    title: "Ocupación de sillas en panal",
    shape: "hex",
    gap: 3,
    cellLabels: true,
    height: 360,
  },
};

const stamps = Array.from({ length: 112 }, (_, index) => new Date(2026, 5, 15 + index));
const barberNames = ["Kevin", "Renzo", "Abel", "Diego"];
const dailyCuts = barberNames.map((_, barber) =>
  stamps.map((date, index) => {
    const weekday = (date.getDay() + 6) % 7;
    const base = weekday === 5 ? 16 : weekday === 6 ? 4 : 9;
    return Math.round(base + seeded(index * 4 + barber) * 6);
  }),
);

/** Columns are real dates: only Mondays and month starts get a label, like a time axis. */
export const ContinuousDatetime: Story = {
  args: {
    title: "Cortes por barbero y día",
    rows: barberNames,
    columns: stamps,
    values: dailyCuts,
    domain: [0, 24],
    valueFormat: (value: number) => String(Math.round(value)),
    gap: 1,
    radius: 2,
    height: 190,
    labels: { ...spanishLabels, category: "Barbero" },
  },
};

const denseRows = Array.from({ length: 48 }, (_, index) => `Silla ${index + 1}`);
const denseColumns = Array.from({ length: 366 }, (_, index) => new Date(2026, 0, 1 + index));
const denseValues = denseRows.map((_, row) =>
  denseColumns.map((date, column) => {
    const weekday = (date.getDay() + 6) % 7;
    const season = 40 + 25 * Math.sin((column / 366) * Math.PI * 2 - 1);
    return Math.round(
      Math.max(
        0,
        Math.min(
          100,
          season +
            (weekday === 5 ? 18 : weekday === 6 ? -25 : 0) +
            seeded(row * 400 + column) * 24 -
            12,
        ),
      ),
    );
  }),
);

/** 17 568 celdas pintadas en un canvas; el cursor y el teclado siguen funcionando. */
export const CanvasDense: Story = {
  args: {
    title: "Ocupación por silla y día del año",
    rows: denseRows,
    columns: denseColumns,
    values: denseValues,
    renderer: "canvas",
    domain: [0, 100],
    gap: 0,
    radius: 0,
    height: 420,
    animate: false,
  },
};

const months = ["abr", "may", "jun", "jul", "ago", "sep", "oct"];
const weekdays = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

function dayLevel(
  barber: string,
  barberIndex: number,
  month: string,
  monthIndex: number,
): HeatmapLevel {
  const weeks = ["Semana 1", "Semana 2", "Semana 3", "Semana 4"];
  return {
    name: `${barber} · ${month}`,
    title: `Cortes de ${barber} en ${month}, por semana y día`,
    rows: weeks,
    columns: weekdays,
    values: weeks.map((_, week) =>
      weekdays.map((_, day) =>
        Math.round(
          (day === 5 ? 14 : day === 6 ? 4 : 9) +
            seeded(barberIndex * 997 + monthIndex * 31 + week * 7 + day) * 6,
        ),
      ),
    ),
    domain: [0, 22],
    valueFormat: "integer",
    drill: ({ row, column }) => ({
      name: `${weeks[row]} · ${weekdays[column]}`,
      title: `Cortes de ${barber} por hora`,
      rows: [barber],
      columns: hours,
      values: [
        hours.map((_, hour) =>
          Math.round(
            1 +
              (hour >= 3 && hour <= 4 ? 2 : 0) +
              (hour >= 8 ? 2 : 0) +
              seeded(row * 53 + column * 17 + hour) * 2,
          ),
        ),
      ],
      domain: [0, 6],
      valueFormat: "integer",
    }),
  };
}

const drillRoot: HeatmapLevel = {
  name: "Todo el año",
  rows: barberNames,
  columns: months,
  values: barberNames.map((_, barber) =>
    months.map((_, month) => Math.round(160 + seeded(barber * 17 + month) * 120)),
  ),
  domain: [140, 300],
  valueFormat: "integer",
  drill: ({ row, column }) =>
    dayLevel(barberNames[row] as string, row, months[column] as string, column),
};

/** Click a cell to open its detail; the breadcrumb climbs back. */
export const Drilldown: Story = {
  render: (args) => (
    <DrilldownHeatmap
      title="Cortes por barbero y mes"
      root={drillRoot}
      breadcrumbLabel="Ruta del mapa de calor"
      cellLabels
      gap={args.gap}
      radius={args.radius}
      animate={args.animate}
      tooltip={args.tooltip}
      labels={{ ...spanishLabels, category: "Barbero" }}
    />
  ),
};

export const NarrowDrilldown: Story = {
  ...Drilldown,
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};

export const Loading: Story = {
  args: { loading: true },
};

export const Empty: Story = {
  args: { values: days.map(() => hours.map(() => null)) },
};

/** 320 px container: shorter row labels, thinned hour labels, legend below. */
export const Narrow: Story = {
  args: { cellLabels: true },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};

/** The calendar keeps the most recent weeks that fit at 320 px. */
export const NarrowCalendar: Story = {
  ...Calendar,
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};
