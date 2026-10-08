import type { Meta, StoryObj } from "@storybook/react-vite";
import { seriesColor } from "../palette.js";
import { BoxGlyph } from "./marks.js";
import { type BoxStats, boxStats } from "./stats.js";

const WIDTH = 240;
const HEIGHT = 240;
const MAX_MINUTES = 120;

/** Minutes of every haircut Kevin did last week; the 95 and 110 are long fades. */
const kevinDurations = [25, 30, 30, 35, 35, 40, 40, 45, 45, 50, 55, 95, 110];

function summarize(values: readonly number[]): BoxStats {
  const stats = boxStats(values);
  if (!stats) throw new Error("The sample needs at least one value");
  return stats;
}

const stats = summarize(kevinDurations);
const vertical = (value: number) => HEIGHT - 20 - (value / MAX_MINUTES) * (HEIGHT - 40);
const horizontal = (value: number) => 20 + (value / MAX_MINUTES) * (WIDTH - 40);

const meta = {
  title: "Charts/Primitives/BoxGlyph",
  component: BoxGlyph,
  tags: ["autodocs"],
  args: {
    stats,
    map: vertical,
    center: WIDTH / 2,
    size: 64,
    horizontal: false,
    color: seriesColor(0),
    variant: "box",
    showMean: true,
    showOutliers: true,
    dimmed: false,
    active: false,
  },
  argTypes: {
    stats: { control: false },
    map: { control: false },
    center: { control: { type: "range", min: 40, max: 200, step: 1 } },
    size: { control: { type: "range", min: 16, max: 120, step: 1 } },
    horizontal: { control: "boolean" },
    color: { control: "color" },
    variant: { control: "inline-radio", options: ["box", "inner"] },
    showMean: { control: "boolean" },
    showOutliers: { control: "boolean" },
    activeOutlier: { control: false },
    dimmed: { control: "boolean" },
    active: { control: "boolean" },
  },
  decorators: [
    (Story) => (
      <svg
        width={WIDTH}
        height={HEIGHT}
        role="img"
        aria-label="Service duration of one barber"
        className="max-w-full"
      >
        <title>Service duration of one barber</title>
        <Story />
      </svg>
    ),
  ],
} satisfies Meta<typeof BoxGlyph>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One box-and-whisker: IQR box, median, whiskers, mean diamond and outliers. */
export const Default: Story = {};

export const Horizontal: Story = {
  args: { horizontal: true, map: horizontal, center: HEIGHT / 2 },
};

/** Slim dark box used inside violins and rainclouds. */
export const InnerVariant: Story = { args: { variant: "inner", size: 14 } };

export const WithoutMeanAndOutliers: Story = { args: { showMean: false, showOutliers: false } };

export const Active: Story = { args: { active: true } };

export const Dimmed: Story = { args: { dimmed: true } };
