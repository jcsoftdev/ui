import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { BarChart } from "../bar-chart/bar-chart.js";
import { formatCurrency } from "../core/format.js";
import { seriesColor } from "../core/palette.js";
import { LineChart } from "../line-chart/line-chart.js";
import { ChartGrid, type ChartGridContext, type ChartGridPanel } from "./chart-grid.js";

const days = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

function wobble(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43_758.5453;
  return x - Math.floor(x);
}

const barbers = ["Kevin", "Renzo", "Abel", "Diego", "Luis", "Marco"];

/** Ventas (S/) por día de la semana de cada barbero: sábado sube, domingo baja. */
const thisWeek = barbers.map((_, barber) =>
  days.map((_, day) => {
    const shape = [0.7, 0.8, 0.85, 0.9, 1.05, 1.35, 0.45][day] as number;
    return Math.round((260 + barber * 45) * shape + wobble(barber * 9 + day) * 60);
  }),
);
const lastWeek = thisWeek.map((row, barber) =>
  row.map((value, day) => Math.round(value * (0.82 + wobble(barber * 31 + day) * 0.3))),
);

const extentOf = (...rows: number[][]): readonly [number, number] => {
  const all = rows.flat();
  return [Math.min(...all), Math.max(...all)];
};

const linePanels: ChartGridPanel[] = barbers.map((name, index) => ({
  id: name,
  title: name,
  subtitle: formatCurrency(
    (thisWeek[index] as number[]).reduce((sum, value) => sum + value, 0),
    { decimals: 0 },
  ),
  extent: extentOf(thisWeek[index] as number[], lastWeek[index] as number[]),
}));

const lineLegend = [
  { id: "actual", name: "Esta semana", color: seriesColor(0), shape: "line" as const },
  { id: "previa", name: "Semana anterior", color: seriesColor(1), shape: "dashed" as const },
];

const none = (_panel: ChartGridPanel, _context: ChartGridContext): ReactNode => null;

const meta = {
  title: "Charts/ChartGrid",
  component: ChartGrid,
  tags: ["autodocs"],
  args: {
    title: "Ventas por barbero",
    panels: linePanels,
    children: none,
    minPanelWidth: 220,
    maxColumns: 3,
    gap: 16,
    panelHeight: 150,
    sharedValueDomain: true,
    sharedXDomain: false,
    includeZero: false,
    syncHover: false,
    bordered: false,
    emptyLabel: "Sin barberos para mostrar",
  },
  argTypes: {
    minPanelWidth: { control: { type: "range", min: 140, max: 420, step: 10 } },
    maxColumns: { control: { type: "range", min: 1, max: 6, step: 1 } },
    panelHeight: { control: { type: "range", min: 90, max: 320, step: 10 } },
    children: { control: false },
    panels: { control: false },
    legend: { control: false },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 900, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ChartGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

const renderLine: Story["args"] = {
  legend: lineLegend,
  children: (panel, ctx) => {
    const index = barbers.indexOf(panel.id);
    return (
      <LineChart
        title={`Ventas de ${panel.title}`}
        categories={days}
        series={[
          { id: "actual", name: "Esta semana", data: thisWeek[index] as number[] },
          {
            id: "previa",
            name: "Semana anterior",
            data: lastWeek[index] as number[],
            dashed: true,
          },
        ]}
        valueFormat="currency"
        height={ctx.height}
        yAxis={ctx.valueDomain ? { min: ctx.valueDomain[0], max: ctx.valueDomain[1] } : undefined}
        legend={false}
        labels={{ empty: "Sin ventas", loading: "Cargando", explore: "Puntos del gráfico." }}
      />
    );
  },
};

/** Misma escala en todos los paneles: la misma altura significa el mismo monto. */
export const Trellis: Story = { args: renderLine };

/** El puntero de un panel dibuja una guía en los demás. */
export const TrellisSyncHover: Story = { args: { ...renderLine, syncHover: true } };

const services = ["Corte", "Barba", "Combo", "Tinte"];
const serviceCounts = ["Miraflores", "Surco", "San Isidro", "La Molina"].map((_, branch) =>
  services.map((_, service) => Math.round(20 + wobble(branch * 7 + service) * 70)),
);

const barPanels: ChartGridPanel[] = ["Miraflores", "Surco", "San Isidro", "La Molina"].map(
  (name, index) => ({
    id: name,
    title: name,
    subtitle: `${(serviceCounts[index] as number[]).reduce((sum, value) => sum + value, 0)} servicios`,
    extent: extentOf(serviceCounts[index] as number[]),
  }),
);

export const TrellisBars: Story = {
  args: {
    title: "Servicios por sede",
    panels: barPanels,
    includeZero: true,
    maxColumns: 4,
    minPanelWidth: 180,
    children: (panel, ctx) => {
      const index = barPanels.findIndex((item) => item.id === panel.id);
      return (
        <BarChart
          title={`Servicios en ${panel.title}`}
          categories={services}
          series={[
            {
              id: "servicios",
              name: "Servicios",
              data: serviceCounts[index] as number[],
              color: seriesColor(index),
            },
          ]}
          valueFormat="integer"
          height={ctx.height}
          yAxis={ctx.valueDomain ? { min: 0, max: ctx.valueDomain[1] } : undefined}
          legend={false}
          labels={{ empty: "Sin servicios", loading: "Cargando", explore: "Barras del gráfico." }}
        />
      );
    },
  },
};

export const Narrow: Story = {
  args: renderLine,
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};

export const Empty: Story = { args: { panels: [] } };
