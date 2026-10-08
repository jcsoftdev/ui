import type { Meta, StoryObj } from "@storybook/react-vite";
import { formatNumber } from "../format.js";
import { resolveDistributionLabels } from "./labels.js";
import { BoxStatsTable } from "./marks.js";
import { boxStats } from "./stats.js";

const labels = resolveDistributionLabels({
  category: "Barbero",
  median: "Mediana",
  mean: "Promedio",
  outliers: "Atípicos",
  min: "Mín",
  max: "Máx",
});

const minutes = (value: number) => `${formatNumber(value, { maximumFractionDigits: 0 })} min`;

const kevin = [25, 30, 30, 35, 35, 40, 40, 45, 45, 50, 55, 95, 110];
const diego = [30, 35, 40, 40, 45, 50, 50, 55, 60, 65];
const andrea = [20, 25, 25, 30, 30, 30, 35, 40, 40, 45];

const meta = {
  title: "Charts/Primitives/BoxStatsTable",
  component: BoxStatsTable,
  tags: ["autodocs"],
  args: {
    caption: "Duración del servicio por barbero",
    labels,
    rows: [
      { name: "Kevin", stats: boxStats(kevin), format: minutes },
      { name: "Diego", stats: boxStats(diego), format: minutes },
      { name: "Andrea", stats: boxStats(andrea), format: minutes },
      { name: "Renzo", stats: null, format: minutes },
    ],
  },
  argTypes: {
    caption: { control: "text" },
    labels: { control: false },
    rows: { control: false },
  },
  decorators: [
    (Story) => (
      // The table is visually hidden inside charts; this wrapper reveals it for inspection.
      <div className="@container w-[560px] max-w-full overflow-x-auto [&_.sr-only]:not-sr-only [&_caption]:pb-2 [&_caption]:text-left [&_caption]:font-semibold [&_table]:w-full [&_table]:text-[12px] [&_td]:px-2 [&_td]:py-1 [&_td]:text-right [&_th]:px-2 [&_th]:py-1 [&_th]:text-left">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BoxStatsTable>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The accessible table behind every box, violin and raincloud chart (revealed here). */
export const Default: Story = {};

export const SingleRow: Story = {
  args: { rows: [{ name: "Kevin", stats: boxStats(kevin), format: minutes }] },
};
