import type { Meta, StoryObj } from "@storybook/react-vite";
import { TrendChip } from "../../atoms/trend-chip/trend-chip.js";
import { Wallet } from "../../icons/index.js";
import { Kpi } from "./kpi.js";

const meta = {
  title: "Containers/Kpi",
  component: Kpi,
  tags: ["autodocs"],
  args: { label: "Citas hoy", value: "12", description: "3 pendientes", variant: "default" },
  argTypes: {
    variant: { control: "inline-radio", options: ["default", "danger"] },
    label: { control: "text" },
    value: { control: "text" },
    suffix: { control: "text" },
    description: { control: "text" },
  },
  decorators: [
    (Story) => (
      <div className="max-w-xs overflow-hidden rounded-lg border border-line">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Kpi>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithSuffix: Story = {
  args: { label: "Ingresos del día", value: "S/ 840", suffix: "/ 1 200", description: undefined },
};

export const Danger: Story = {
  args: {
    label: "Inventario bajo",
    value: "4",
    suffix: "/ 18",
    description: "Pomada mate, navajas y 2 más",
    variant: "danger",
  },
};

export const Occupancy: Story = {
  args: { label: "Ocupación", value: "78%", description: "Barbero: Diego Quispe" },
};

/** 320 px container: use it to check the narrow layout without resizing the viewport. */
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="@container/page w-[320px] max-w-full">
        <Story />
      </div>
    ),
  ],
};

export const ToneDotIconTrend: Story = {
  args: {
    label: "Cobrado",
    value: "S/ 4 280",
    description: "Hoy",
    tone: "success",
    dot: true,
    icon: <Wallet aria-hidden="true" />,
    trend: <TrendChip value={12.5} />,
  },
};
