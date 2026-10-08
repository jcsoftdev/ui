import type { Meta, StoryObj } from "@storybook/react-vite";
import { AxisBottom, AxisLeft, AxisRight, type AxisTick, GridLines } from "./axes.js";

const WIDTH = 480;
const HEIGHT = 200;
const MARGIN = { top: 28, right: 56, bottom: 28, left: 56 };
const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;

const days = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const dayTicks: AxisTick[] = days.map((label, index) => ({
  key: label,
  position: (index + 0.5) * (plotWidth / days.length),
  label,
}));

const salesTicks: AxisTick[] = [0, 500, 1000, 1500, 2000].map((value) => ({
  key: value,
  position: plotHeight - (value / 2000) * plotHeight,
  label: `S/ ${value}`,
}));

const cutsTicks: AxisTick[] = [0, 20, 40, 60, 80].map((value) => ({
  key: value,
  position: plotHeight - (value / 80) * plotHeight,
  label: String(value),
}));

interface AxesDemoProps {
  title: string;
  rightTitle: string;
  showRight: boolean;
  showGrid: boolean;
}

function AxesDemo({ title, rightTitle, showRight, showGrid }: AxesDemoProps) {
  return (
    <svg
      width={WIDTH}
      height={HEIGHT}
      role="img"
      aria-label="Ejes de ejemplo"
      className="max-w-full"
    >
      <title>Ejes de ejemplo</title>
      <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
        {showGrid ? (
          <GridLines
            ticks={salesTicks}
            direction="horizontal"
            length={plotWidth}
            zero={plotHeight}
          />
        ) : null}
        <AxisLeft ticks={salesTicks} offset={0} title={title} />
        {showRight ? <AxisRight ticks={cutsTicks} offset={plotWidth} title={rightTitle} /> : null}
        <AxisBottom ticks={dayTicks} offset={plotHeight} />
      </g>
    </svg>
  );
}

const meta = {
  title: "Charts/Primitives/Axes",
  component: AxisBottom,
  tags: ["autodocs"],
  args: { ticks: dayTicks, offset: plotHeight },
  argTypes: {
    ticks: { control: false },
    offset: { control: false },
    title: { control: false },
  },
} satisfies Meta<typeof AxisBottom>;

export default meta;
type Story = StoryObj<typeof meta>;

/** `GridLines`, `AxisLeft` and `AxisBottom` composed inside a plot group. */
export const Default: Story = {
  render: () => <AxesDemo title="Ventas" rightTitle="Cortes" showRight={false} showGrid />,
};

/** A second value axis on the right with its own scale. */
export const DualAxis: Story = {
  render: () => <AxesDemo title="Ventas" rightTitle="Cortes" showRight showGrid />,
};

export const WithoutGrid: Story = {
  render: () => <AxesDemo title="Ventas" rightTitle="Cortes" showRight={false} showGrid={false} />,
};
