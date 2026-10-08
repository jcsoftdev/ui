import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChartEmpty, ChartSkeleton } from "./chart-states.js";

const meta = {
  title: "Charts/Primitives/ChartSkeleton",
  component: ChartSkeleton,
  tags: ["autodocs"],
  args: { height: 220, label: "Cargando ventas", shape: "bars" },
  argTypes: {
    height: { control: "number" },
    label: { control: "text" },
    shape: { control: "inline-radio", options: ["bars", "line", "ring"] },
  },
} satisfies Meta<typeof ChartSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Bars: Story = {};

export const Line: Story = { args: { shape: "line" } };

export const Ring: Story = { args: { shape: "ring" } };

/** `ChartEmpty` keeps the chart footprint and says why nothing is drawn. */
export const Empty: Story = {
  render: (args) => (
    <ChartEmpty height={args.height} label="Sin ventas registradas en este periodo" />
  ),
};
