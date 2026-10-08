import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChartFrame } from "../chart-frame.js";
import { resolveDistributionLabels } from "./labels.js";
import { categoryLayout } from "./layout.js";
import { CategoryAxes } from "./marks.js";

const labels = resolveDistributionLabels({
  empty: "Sin atenciones en este periodo",
  loading: "Cargando gráfico",
});

const barbers = ["Kevin", "Diego", "Andrea", "Mateo", "Renzo"];

function layoutFor(width: number, height: number, horizontal: boolean) {
  return categoryLayout({
    width,
    height,
    orientation: horizontal ? "horizontal" : "vertical",
    categories: barbers,
    seriesCount: 1,
    extent: [15, 110],
    valueFormat: "number",
  });
}

const meta = {
  title: "Charts/Primitives/CategoryAxes",
  component: CategoryAxes,
  tags: ["autodocs"],
  args: { layout: layoutFor(480, 260, false), title: "min", grid: true },
  argTypes: {
    layout: { control: false },
    title: { control: "text" },
    grid: { control: "boolean" },
  },
  decorators: [
    (Story) => (
      <div className="@container w-[560px] max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CategoryAxes>;

export default meta;
type Story = StoryObj<typeof meta>;

function AxesFrame({
  horizontal,
  title,
  grid,
}: {
  horizontal: boolean;
  title?: string;
  grid?: boolean;
}) {
  return (
    <ChartFrame height={260} labels={labels}>
      {(width, height) => {
        const layout = layoutFor(width, height, horizontal);
        return (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label="Duración por barbero"
            className="block overflow-visible"
          >
            <title>Duración por barbero</title>
            <g transform={`translate(${layout.margin.left},${layout.margin.top})`}>
              <CategoryAxes layout={layout} title={title} grid={grid} />
            </g>
          </svg>
        );
      }}
    </ChartFrame>
  );
}

/** Categories along x, values up the y axis. */
export const Default: Story = {
  render: (args) => <AxesFrame horizontal={false} title={args.title} grid={args.grid} />,
};

/** One row per category, values along x. */
export const Horizontal: Story = {
  render: (args) => <AxesFrame horizontal title={args.title} grid={args.grid} />,
};

export const WithoutGrid: Story = {
  args: { grid: false },
  render: (args) => <AxesFrame horizontal={false} title={args.title} grid={args.grid} />,
};
