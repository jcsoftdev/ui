import type { Meta, StoryObj } from "@storybook/react-vite";
import { CalendarHeatmap } from "./calendar-heatmap.js";
import type { CalendarDay } from "./calendar-layout.js";
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
