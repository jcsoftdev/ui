import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { ChartLegend, type LegendItem } from "./legend.js";

const items: LegendItem[] = [
  { id: "cortes", name: "Cortes", color: "var(--chart-cat-1)", shape: "square" },
  { id: "barba", name: "Barba", color: "var(--chart-cat-2)", shape: "square" },
  { id: "color", name: "Color", color: "var(--chart-cat-3)", shape: "dot" },
  { id: "meta", name: "Meta semanal", color: "var(--chart-cat-4)", shape: "dashed" },
  { id: "anterior", name: "Semana anterior", color: "var(--chart-cat-5)", shape: "line" },
];

const meta = {
  title: "Charts/Primitives/ChartLegend",
  component: ChartLegend,
  tags: ["autodocs"],
  args: { items, align: "start" },
  argTypes: {
    items: { control: "object" },
    align: { control: "inline-radio", options: ["start", "center", "end"] },
    onToggle: { action: "toggle" },
    onHighlight: { action: "highlight" },
  },
} satisfies Meta<typeof ChartLegend>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ReadOnly: Story = {};

/** Each item is a toggle button; at least one series always stays visible. */
export const Toggleable: Story = {
  render: (args) => {
    const [hidden, setHidden] = useState<string[]>(["color"]);
    return (
      <ChartLegend
        {...args}
        items={items.map((item) => ({ ...item, hidden: hidden.includes(item.id) }))}
        onToggle={(id) =>
          setHidden((current) =>
            current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
          )
        }
      />
    );
  },
};

export const Centered: Story = { args: { align: "center" } };
