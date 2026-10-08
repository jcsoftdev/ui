import type { Meta, StoryObj } from "@storybook/react-vite";
import { Kpi } from "../../containers/kpi/index.js";
import { formatCurrency } from "../core/format.js";
import { Sparkline } from "./sparkline.js";

const salesLast14 = [
  980, 1120, 1045, 1230, 1580, 2140, 690, 1010, 1185, 1260, 1210, 1690, 2290, 740,
];
const days = [
  "lun",
  "mar",
  "mié",
  "jue",
  "vie",
  "sáb",
  "dom",
  "lun",
  "mar",
  "mié",
  "jue",
  "vie",
  "sáb",
  "dom",
];
const appointmentsPerHour = [2, 3, 4, 3, 1, 2, 4, 5, 5, 3, 2];
const hours = [
  "9:00",
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
];
const waxStock = [48, 46, 45, 41, 40, 37, 35, 31, 30, 26, 24, 21];

const meta = {
  title: "Charts/Sparkline",
  component: Sparkline,
  tags: ["autodocs"],
  args: {
    data: salesLast14,
    label: "Ventas de los últimos 14 días",
    type: "line",
    height: 36,
    showLast: true,
    valueFormat: "currency",
    categories: days,
    animate: true,
  },
  argTypes: {
    type: { control: "inline-radio", options: ["line", "area", "bar"] },
    color: {
      control: "select",
      options: [undefined, "var(--chart-cat-1)", "var(--chart-cat-2)", "var(--danger)"],
    },
    height: { control: { type: "range", min: 20, max: 80, step: 2 } },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 220, padding: 24 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Sparkline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Area: Story = { args: { type: "area" } };

export const Bars: Story = {
  args: {
    type: "bar",
    data: appointmentsPerHour,
    categories: hours,
    label: "Citas por hora hoy",
    valueFormat: "integer",
    highlightIndex: 7,
    color: "var(--chart-cat-1)",
  },
};

export const FallingStock: Story = {
  args: {
    type: "area",
    data: waxStock,
    label: "Stock de cera, últimas 12 semanas",
    valueFormat: "integer",
    categories: undefined,
    color: "var(--danger)",
  },
};

export const InKpiTiles: Story = {
  name: "Inside KPI tiles",
  decorators: [
    (Story) => (
      <div style={{ width: 720, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
  render: () => (
    <div className="grid grid-cols-3 gap-px overflow-hidden rounded-card bg-line shadow-flat">
      <div className="flex flex-col bg-surface pb-3.5">
        <Kpi label="Ventas de hoy" value={formatCurrency(740)} description="Domingo, medio día" />
        <div className="px-[18px]">
          <Sparkline
            data={salesLast14}
            categories={days}
            type="area"
            valueFormat="currency"
            label="Ventas de los últimos 14 días"
          />
        </div>
      </div>
      <div className="flex flex-col bg-surface pb-3.5">
        <Kpi label="Citas por hora" value="5" suffix="máx." />
        <div className="px-[18px]">
          <Sparkline
            data={appointmentsPerHour}
            categories={hours}
            type="bar"
            valueFormat="integer"
            color="var(--chart-cat-1)"
            label="Citas por hora hoy"
          />
        </div>
      </div>
      <div className="flex flex-col bg-surface pb-3.5">
        <Kpi label="Cera en stock" value="21" suffix="u." variant="danger" />
        <div className="px-[18px]">
          <Sparkline
            data={waxStock}
            type="line"
            valueFormat="integer"
            color="var(--danger)"
            label="Stock de cera, últimas 12 semanas"
          />
        </div>
      </div>
    </div>
  ),
};
