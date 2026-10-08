import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChartPatternDefs } from "./pattern-defs.js";
import { PATTERN_NAMES, patternId } from "./patterns.js";

const items = PATTERN_NAMES.map((name, index) => ({
  id: patternId("gallery", name),
  pattern: name,
  color: `var(--chart-cat-${(index % 7) + 1})`,
}));

const meta = {
  title: "Charts/Primitives/ChartPatternDefs",
  component: ChartPatternDefs,
  tags: ["autodocs"],
  args: { items },
  argTypes: { items: { control: "object" } },
  render: (args) => (
    <div>
      <svg width={0} height={0} aria-hidden="true" className="absolute">
        <defs>
          <ChartPatternDefs {...args} />
        </defs>
      </svg>
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-3 p-0">
        {args.items.map((item) => (
          <li key={item.id} className="grid gap-1.5">
            <svg
              viewBox="0 0 110 64"
              role="img"
              aria-label={String(item.pattern)}
              className="w-full rounded-tile border border-line"
            >
              <title>{String(item.pattern)}</title>
              <rect width={110} height={64} style={{ fill: `url(#${item.id})` }} />
            </svg>
            <span className="text-[12px] text-ink-2">
              {typeof item.pattern === "string" ? item.pattern : "personalizado"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  ),
} satisfies Meta<typeof ChartPatternDefs>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every named pattern in its own series color. */
export const Gallery: Story = {};

/** A custom tile: the pattern can also be given as data. */
export const CustomTile: Story = {
  args: {
    items: [
      {
        id: patternId("gallery", "custom"),
        pattern: {
          size: 10,
          backdrop: 0.15,
          shapes: [
            { type: "circle", cx: 5, cy: 5, r: 2 },
            { type: "line", x1: 0, y1: 10, x2: 10, y2: 0, width: 1 },
          ],
        },
        color: "var(--chart-cat-1)",
      },
    ],
  },
};
