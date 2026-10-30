import type { Meta, StoryObj } from "@storybook/react-vite";
import { KpiGroup, type KpiGroupItem } from "./kpi-group.js";

const items: KpiGroupItem[] = [
  {
    id: "ingresos",
    label: "Ingresos del mes",
    value: 18420,
    format: { style: "currency", currency: "PEN", maximumFractionDigits: 0 },
    trend: 12.5,
    trendLabel: "vs. mes anterior",
  },
  { id: "citas", label: "Citas atendidas", value: 214, trend: 4.1, trendLabel: "vs. mes anterior" },
  {
    id: "ocupacion",
    label: "Ocupación",
    value: 0.78,
    format: { style: "percent" },
    trend: -2.4,
    description: "Barbero con más agenda: Diego Quispe",
  },
  {
    id: "cancelaciones",
    label: "Cancelaciones",
    value: 9,
    trend: -18,
    invertTrend: true,
    description: "Menos cancelaciones es mejor",
  },
];

const meta = {
  title: "Containers/KpiGroup",
  component: KpiGroup,
  tags: ["autodocs"],
  args: { items, animate: true },
  argTypes: { animate: { control: "boolean" }, items: { control: false } },
  decorators: [
    (Story) => (
      <div className="w-full max-w-4xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof KpiGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="w-[320px] max-w-full">
        <Story />
      </div>
    ),
  ],
};

/** `minColumns={2}` keeps two tiles across on the narrowest containers. */
export const TwoColumnsWhenNarrow: Story = {
  args: { minColumns: 2 },
  decorators: Narrow.decorators,
};

export const TwoColumns: Story = {
  decorators: [
    (Story) => (
      <div className="w-[480px] max-w-full">
        <Story />
      </div>
    ),
  ],
};

export const BrutalPreset: Story = {
  decorators: [
    (Story) => (
      <div data-style="brutal" className="bg-bg p-card">
        <Story />
      </div>
    ),
  ],
};

export const GlassPreset: Story = {
  decorators: [
    (Story) => (
      <div data-style="glass" className="bg-bg p-card">
        <Story />
      </div>
    ),
  ],
};

/** Separate cards in as many columns as fit 150 px; resize the frame to see them reflow. */
export const AutoFit: Story = {
  args: { layout: "auto-fit", minItemWidth: 150 },
};
