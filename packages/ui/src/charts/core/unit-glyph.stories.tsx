import type { Meta, StoryObj } from "@storybook/react-vite";
import { useId } from "react";
import { seriesColor } from "./palette.js";
import { UnitGlyph } from "./unit-glyph.js";
import { resolveUnitShape } from "./unit-icons.js";

const CELL = 56;
const fills = [1, 0.75, 0.4, 0];

function GlyphRow(props: Parameters<typeof UnitGlyph>[0]) {
  const id = useId();
  return (
    <svg
      width={CELL * fills.length}
      height={CELL}
      role="img"
      aria-label="Clientes atendidos"
      className="max-w-full"
    >
      <title>Clientes atendidos</title>
      {fills.map((fill, index) => (
        <UnitGlyph
          key={fill}
          {...props}
          x={index * CELL}
          y={0}
          fill={fill}
          clipId={`${id}-${index}`}
        />
      ))}
    </svg>
  );
}

const meta = {
  title: "Charts/Primitives/UnitGlyph",
  component: UnitGlyph,
  tags: ["autodocs"],
  args: {
    shape: resolveUnitShape("person"),
    x: 0,
    y: 0,
    size: CELL,
    fill: 1,
    color: seriesColor(0),
    track: true,
    clipId: "unit-glyph",
    direction: "right",
  },
  argTypes: {
    shape: { control: false },
    x: { control: false },
    y: { control: false },
    size: { control: { type: "range", min: 24, max: 96, step: 2 } },
    fill: { control: { type: "range", min: 0, max: 1, step: 0.05 } },
    color: { control: "color" },
    track: { control: "boolean" },
    clipId: { control: false },
    direction: { control: "inline-radio", options: ["right", "up"] },
  },
} satisfies Meta<typeof UnitGlyph>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Full, three-quarter, partial and empty units: partial ones clip the colored copy. */
export const Default: Story = { render: (args) => <GlyphRow {...args} /> };

/** Partial units rise from the bottom, like a gauge. */
export const FillsUp: Story = {
  args: { direction: "up" },
  render: (args) => <GlyphRow {...args} />,
};

export const Scissors: Story = {
  args: { shape: resolveUnitShape("scissors"), color: seriesColor(2) },
  render: (args) => <GlyphRow {...args} />,
};

export const WithoutTrack: Story = {
  args: { track: false },
  render: (args) => <GlyphRow {...args} />,
};
