import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChartTooltip, type TooltipRow } from "./tooltip.js";

const rows: TooltipRow[] = [
  { id: "cortes", name: "Cortes", value: "S/ 840", color: "var(--chart-cat-1)", note: "(58%)" },
  { id: "barba", name: "Barba", value: "S/ 390", color: "var(--chart-cat-2)", note: "(27%)" },
  {
    id: "color",
    name: "Color",
    value: "S/ 220",
    color: "var(--chart-cat-3)",
    shape: "dot",
    note: "(15%)",
  },
  { id: "total", name: "Total", value: "S/ 1,450", color: "transparent", emphasis: true },
];

const meta = {
  title: "Charts/Primitives/ChartTooltip",
  component: ChartTooltip,
  tags: ["autodocs"],
  args: { x: 120, y: 80, containerWidth: 420, title: "Sábado 4 oct", rows },
  argTypes: {
    x: { control: { type: "range", min: 0, max: 420 } },
    y: { control: { type: "range", min: 0, max: 200 } },
    containerWidth: { control: false },
    title: { control: "text" },
    rows: { control: "object" },
  },
  decorators: [
    (Story) => (
      <div className="relative h-[200px] w-[420px] max-w-full rounded-tile border border-line bg-surface-2">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ChartTooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Past 60% of the container width the card flips to the left of the anchor. */
export const FlipsNearTheRightEdge: Story = { args: { x: 380 } };

export const WithoutTitle: Story = { args: { title: undefined, rows: rows.slice(0, 2) } };
