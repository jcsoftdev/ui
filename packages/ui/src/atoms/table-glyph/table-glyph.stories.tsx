import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import type { TableShape } from "./layout.js";
import { TableGlyph } from "./table-glyph.js";

const meta = {
  title: "Atoms/TableGlyph",
  component: TableGlyph,
  tags: ["autodocs"],
  args: { shape: "round", seats: 4, occupied: 0, size: "md" },
  argTypes: {
    shape: { control: "inline-radio", options: ["round", "square", "rect", "bar"] },
    seats: { control: { type: "number", min: 1, max: 12 } },
    occupied: { control: { type: "number", min: 0, max: 12 } },
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
    pattern: { control: "inline-radio", options: ["dashed", "solid", "soft", "strong"] },
  },
} satisfies Meta<typeof TableGlyph>;

export default meta;
type Story = StoryObj<typeof meta>;

const shapes: TableShape[] = ["round", "square", "rect", "bar"];

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const svg = canvasElement.querySelector("svg") as SVGElement;
    await expect(svg).toHaveAttribute("aria-hidden", "true");
    await expect(svg.querySelectorAll("[data-part=chair]")).toHaveLength(4);
  },
};

export const Labelled: Story = {
  args: { "aria-label": "Table 4, round, four seats" },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("svg")).toHaveAttribute("role", "img");
  },
};

export const Shapes: Story = {
  render: (args) => (
    <div className="grid grid-cols-[auto_repeat(6,auto)] items-center gap-x-6 gap-y-4 text-meta">
      {shapes.map((shape) => (
        <div key={shape} className="contents">
          <span className="text-ink-3">{shape}</span>
          {[1, 2, 3, 4, 6, 8].map((seats) => (
            <TableGlyph key={seats} {...args} shape={shape} seats={seats} />
          ))}
        </div>
      ))}
    </div>
  ),
};

export const Occupied: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-6">
      {shapes.map((shape) => (
        <TableGlyph key={shape} {...args} shape={shape} seats={6} occupied={4} />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll("[data-part=chair][data-occupied]")).toHaveLength(
      16,
    );
  },
};

export const Patterns: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-6 text-accent">
      {(["dashed", "solid", "soft", "strong"] as const).map((pattern) => (
        <TableGlyph key={pattern} {...args} seats={4} occupied={2} pattern={pattern} />
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-end gap-6">
      {(["sm", "md", "lg"] as const).map((size) => (
        <TableGlyph key={size} {...args} shape="rect" seats={6} occupied={2} size={size} />
      ))}
    </div>
  ),
};

export const ManySeats: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-6">
      <TableGlyph {...args} shape="round" seats={10} occupied={6} width={2} height={2} />
      <TableGlyph {...args} shape="square" seats={10} occupied={6} width={2} height={2} />
      <TableGlyph {...args} shape="rect" seats={12} occupied={6} width={4} height={1.5} />
      <TableGlyph {...args} shape="rect" seats={8} occupied={6} width={1.5} height={4} />
      <TableGlyph {...args} shape="bar" seats={8} occupied={6} width={5} height={1} />
    </div>
  ),
};

export const Dark: Story = {
  globals: { theme: "dark" },
  render: Occupied.render,
};
