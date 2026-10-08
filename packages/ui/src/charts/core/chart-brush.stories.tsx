import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { ChartBrush, type IndexRange } from "./cartesian/brush.js";

const days = 60;
const sales = Array.from({ length: days }, (_, index) =>
  Math.round(1150 + 220 * Math.sin(index / 3) + (index % 7 === 5 ? 520 : 0) + index * 5),
);

const meta = {
  title: "Charts/Primitives/ChartBrush",
  component: ChartBrush,
  tags: ["autodocs"],
  args: {
    count: days,
    series: [{ id: "ventas", color: "var(--chart-cat-1)", data: sales }],
    range: [10, 30],
    onChange: () => {},
    width: 560,
    left: 12,
    right: 12,
    height: 52,
    label: "Rango visible",
    valueText: "Día 11 al día 31",
  },
  argTypes: {
    count: { control: false },
    series: { control: false },
    range: { control: false },
    width: { control: { type: "range", min: 240, max: 720 } },
    left: { control: "number" },
    right: { control: "number" },
    height: { control: "number" },
    label: { control: "text" },
    valueText: { control: "text" },
    onChange: { action: "change" },
  },
} satisfies Meta<typeof ChartBrush>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Drag the window to pan, its handles to resize, or outside it to draw a new one. Arrows also work. */
export const Default: Story = {
  render: (args) => {
    const [range, setRange] = useState<IndexRange>(args.range);
    return (
      <ChartBrush
        {...args}
        range={range}
        onChange={setRange}
        valueText={`Día ${range[0] + 1} al día ${range[1] + 1}`}
      />
    );
  },
};

export const FullRange: Story = {
  args: { range: [0, days - 1] },
};
