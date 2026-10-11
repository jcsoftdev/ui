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

export const Default: Story = { parameters: { a11y: { test: "todo" } } };

export const Narrow: Story = {
  parameters: { a11y: { test: "todo" } },
  decorators: [
    (Story) => (
      <div className="w-[320px] max-w-full">
        <Story />
      </div>
    ),
  ],
};

export const TwoColumns: Story = {
  parameters: { a11y: { test: "todo" } },
  decorators: [
    (Story) => (
      <div className="w-[480px] max-w-full">
        <Story />
      </div>
    ),
  ],
};

export const BrutalPreset: Story = {
  parameters: { a11y: { test: "todo" } },
  decorators: [
    (Story) => (
      <div data-style="brutal" className="bg-bg p-card">
        <Story />
      </div>
    ),
  ],
};

export const GlassPreset: Story = {
  parameters: { a11y: { test: "todo" } },
  decorators: [
    (Story) => (
      <div data-style="glass" className="bg-bg p-card">
        <Story />
      </div>
    ),
  ],
};
