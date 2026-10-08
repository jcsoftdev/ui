import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChartFrame } from "../chart-frame.js";
import { resolveDistributionLabels } from "./labels.js";
import { xyLayout } from "./layout.js";
import { XYAxes } from "./marks.js";

const labels = resolveDistributionLabels({
  empty: "Sin atenciones en este periodo",
  loading: "Cargando gráfico",
});

function layoutFor(width: number, height: number) {
  return xyLayout({
    width,
    height,
    xExtent: [15, 70],
    yExtent: [10, 80],
    xFormat: "number",
    yFormat: "currency",
    xAxis: { title: "Duración" },
    yAxis: { title: "Ticket" },
  });
}

const meta = {
  title: "Charts/Primitives/XYAxes",
  component: XYAxes,
  tags: ["autodocs"],
  args: {
    layout: layoutFor(480, 280),
    xTitle: "Duración (min)",
    yTitle: "Ticket (S/)",
    grid: true,
  },
  argTypes: {
    layout: { control: false },
    xTitle: { control: "text" },
    yTitle: { control: "text" },
    grid: { control: "boolean" },
  },
  decorators: [
    (Story) => (
      <div className="@container w-[560px] max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof XYAxes>;

export default meta;
type Story = StoryObj<typeof meta>;

function AxesFrame({ xTitle, yTitle, grid }: { xTitle?: string; yTitle?: string; grid?: boolean }) {
  return (
    <ChartFrame height={280} labels={labels}>
      {(width, height) => {
        const layout = layoutFor(width, height);
        return (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label="Duración y ticket"
            className="block overflow-visible"
          >
            <title>Duración y ticket</title>
            <g transform={`translate(${layout.margin.left},${layout.margin.top})`}>
              <XYAxes layout={layout} xTitle={xTitle} yTitle={yTitle} grid={grid} />
            </g>
          </svg>
        );
      }}
    </ChartFrame>
  );
}

/** Two continuous axes with gridlines, as drawn behind scatter and bubble charts. */
export const Default: Story = {
  render: (args) => <AxesFrame xTitle={args.xTitle} yTitle={args.yTitle} grid={args.grid} />,
};

export const WithoutGrid: Story = {
  args: { grid: false },
  render: (args) => <AxesFrame xTitle={args.xTitle} yTitle={args.yTitle} grid={args.grid} />,
};

export const WithoutTitles: Story = {
  args: { xTitle: undefined, yTitle: undefined },
  render: (args) => <AxesFrame xTitle={args.xTitle} yTitle={args.yTitle} grid={args.grid} />,
};
