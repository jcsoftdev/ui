import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChartFrame } from "./chart-frame.js";
import { ChartDataTable } from "./data-table.js";
import { ChartLegend } from "./legend.js";
import { seriesColor } from "./palette.js";
import type { ChartLabels } from "./types.js";

const labels: ChartLabels = {
  empty: "Sin ventas registradas en este periodo",
  loading: "Cargando gráfico",
  resetZoom: "Ver todo",
  total: "Total",
  explore: "Puntos del gráfico. Usa las flechas para recorrerlos.",
  brush: "Rango visible",
  category: "Barbero",
  value: "Cortes",
  share: "Participación",
};

const cuts = [
  { name: "Kevin", value: 38 },
  { name: "Diego", value: 31 },
  { name: "Andrea", value: 27 },
  { name: "Mateo", value: 22 },
  { name: "Renzo", value: 18 },
];

/** Minimal drawing: columns sized from the width and height the frame measures. */
function Columns(width: number, height: number) {
  const max = Math.max(...cuts.map((cut) => cut.value));
  const slot = width / cuts.length;
  return (
    <svg width={width} height={height} role="img" aria-label="Cortes por barbero">
      <title>Cortes por barbero</title>
      {cuts.map((cut, index) => {
        const barHeight = (cut.value / max) * (height - 24);
        return (
          <g key={cut.name}>
            <rect
              x={index * slot + slot * 0.2}
              y={height - 20 - barHeight}
              width={slot * 0.6}
              height={barHeight}
              rx={6}
              style={{ fill: seriesColor(index) }}
            />
            <text
              x={index * slot + slot / 2}
              y={height - 5}
              textAnchor="middle"
              className="fill-ink-3 text-[11px]"
            >
              {cut.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const meta = {
  title: "Charts/Primitives/ChartFrame",
  component: ChartFrame,
  tags: ["autodocs"],
  args: { height: 260, labels, children: Columns },
  argTypes: {
    height: { control: "number" },
    aspectRatio: { control: "number" },
    skeleton: { control: "inline-radio", options: ["bars", "line", "ring"] },
    legendPosition: { control: "inline-radio", options: ["top", "bottom"] },
    loading: { control: "boolean" },
    empty: { control: "boolean" },
    legendAside: { control: "boolean" },
    labels: { control: "object" },
    legend: { control: false },
    table: { control: false },
    footer: { control: false },
    children: { control: false },
  },
} satisfies Meta<typeof ChartFrame>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const FillsParent: Story = {
  args: { height: "fill" },
  decorators: [
    (Story) => (
      <div className="h-[340px] rounded-tile border border-line p-3">
        <Story />
      </div>
    ),
  ],
};

export const AspectRatio: Story = { args: { aspectRatio: 2.4 } };

export const WithLegendAndTable: Story = {
  args: {
    legend: (
      <ChartLegend
        items={cuts.map((cut, index) => ({
          id: cut.name,
          name: cut.name,
          color: seriesColor(index),
        }))}
      />
    ),
    legendPosition: "bottom",
    table: (
      <ChartDataTable
        caption="Cortes por barbero"
        categoryHeader="Barbero"
        categories={cuts.map((cut) => cut.name)}
        columns={[{ id: "cortes", name: "Cortes", values: cuts.map((cut) => String(cut.value)) }]}
      />
    ),
  },
};

export const Loading: Story = { args: { loading: true } };

export const LoadingRing: Story = { args: { loading: true, skeleton: "ring" } };

export const Empty: Story = { args: { empty: true } };
