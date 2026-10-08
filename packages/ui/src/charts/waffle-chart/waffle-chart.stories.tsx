import type { Meta, StoryObj } from "@storybook/react-vite";
import { WaffleChart } from "./waffle-chart.js";

const paymentMethods = [
  { id: "yape", name: "Yape", value: 412 },
  { id: "efectivo", name: "Efectivo", value: 268 },
  { id: "tarjeta", name: "Tarjeta", value: 187 },
  { id: "plin", name: "Plin", value: 96 },
];

const spanishLabels = {
  empty: "Sin datos para mostrar",
  loading: "Cargando gráfico",
  resetZoom: "Ver todo",
  total: "Total",
  explore: "Categorías del gráfico. Usa las flechas para recorrerlas.",
  brush: "Rango visible",
  category: "Medio de pago",
};

const meta = {
  title: "Charts/WaffleChart",
  component: WaffleChart,
  tags: ["autodocs"],
  args: {
    title: "Pagos del mes por medio",
    data: paymentMethods,
    rows: 10,
    columns: 10,
    cellShape: "rounded",
    order: "row",
    gap: 0.14,
    height: 260,
    valueFormat: "integer",
    legend: true,
    tooltip: true,
    animate: true,
    loading: false,
    labels: spanishLabels,
  },
  argTypes: {
    cellShape: { control: "inline-radio", options: ["square", "rounded", "circle"] },
    order: { control: "inline-radio", options: ["row", "column"] },
    legend: { control: "select", options: [true, false, "top", "bottom"] },
    rows: { control: { type: "range", min: 2, max: 20, step: 1 } },
    columns: { control: { type: "range", min: 2, max: 30, step: 1 } },
    gap: { control: { type: "range", min: 0, max: 0.5, step: 0.02 } },
    height: { control: { type: "range", min: 120, max: 420, step: 10 } },
    data: { control: false },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 760, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WaffleChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Squares: Story = { args: { cellShape: "square", order: "column" } };

export const Circles: Story = { args: { cellShape: "circle", gap: 0.2 } };

export const PartOfTotal: Story = {
  name: "Part of a total (occupancy)",
  args: {
    title: "Turnos ocupados esta semana",
    data: [
      { id: "reservados", name: "Reservados", value: 58 },
      { id: "sin-cita", name: "Sin cita", value: 17 },
    ],
    total: 120,
    labels: { ...spanishLabels, category: "Tipo de turno" },
  },
};

export const Wide: Story = {
  name: "Wide grid (5 x 20)",
  args: { rows: 5, columns: 20, height: 140, legend: "bottom" },
};

const occupancyBySede = [
  { id: "miraflores", name: "Miraflores", reserved: 82, walkIn: 11 },
  { id: "san-isidro", name: "San Isidro", reserved: 64, walkIn: 19 },
  { id: "surco", name: "Surco", reserved: 47, walkIn: 22 },
  { id: "barranco", name: "Barranco", reserved: 31, walkIn: 38 },
];

/** One waffle per sede on the same scale. The grid follows the container width: 1, 2 or 4 columns. */
export const SmallMultiples: Story = {
  render: (args) => (
    <div className="@container/multiples">
      <ul className="m-0 grid list-none grid-cols-1 gap-x-6 gap-y-5 p-0 @sm/multiples:grid-cols-2 @3xl/multiples:grid-cols-4">
        {occupancyBySede.map((sede) => (
          <li key={sede.id} className="flex min-w-0 flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <h4 className="m-0 truncate text-[13px] font-bold text-ink">{sede.name}</h4>
              <span className="text-[12px] tabular-nums text-ink-3">
                {sede.reserved + sede.walkIn}%
              </span>
            </div>
            <WaffleChart
              {...args}
              title={`Turnos ocupados en ${sede.name}`}
              data={[
                { id: "reservados", name: "Reservados", value: sede.reserved },
                { id: "sin-cita", name: "Sin cita", value: sede.walkIn },
              ]}
              total={100}
              aspectRatio={1}
              height={undefined}
              legend={false}
              tooltip
            />
          </li>
        ))}
      </ul>
      <p className="m-0 mt-4 flex gap-4 text-[12px] text-ink-3">
        <span className="flex items-center gap-1.5">
          <i className="size-2.5 rounded-xs" style={{ background: "var(--accent-word)" }} />
          Reservados
        </span>
        <span className="flex items-center gap-1.5">
          <i className="size-2.5 rounded-xs" style={{ background: "var(--chart-cat-1)" }} />
          Sin cita
        </span>
        <span>1 cuadro = 1% de los turnos</span>
      </p>
    </div>
  ),
  args: {
    rows: 10,
    columns: 10,
    cellShape: "rounded",
    gap: 0.16,
    labels: { ...spanishLabels, category: "Tipo de turno" },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 900, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
};

/** Same grid in a 320 px container: a single column. */
export const SmallMultiplesNarrow: Story = {
  ...SmallMultiples,
  decorators: [
    (Story) => (
      <div style={{ width: 320, maxWidth: "100%" }}>
        <Story />
      </div>
    ),
  ],
};

export const Loading: Story = { args: { loading: true } };

export const Empty: Story = { args: { data: [] } };

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 320, maxWidth: "100%" }}>
        <Story />
      </div>
    ),
  ],
};
