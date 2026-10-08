import type { Meta, StoryObj } from "@storybook/react-vite";
import { CategoryGroupAxis } from "./category-group-axis.js";
import { categoryGroupSpans } from "./category-groups.js";

const categories = ["Corte", "Barba", "Cejas", "Tinte", "Alisado", "Keratina", "Kids", "Combo"];
const step = 56;
const positions = categories.map((_, index) => step * index + step / 2);
const spans = categoryGroupSpans(
  [
    { label: "Básicos", count: 3 },
    { label: "Color y tratamiento", count: 3 },
    { label: "Otros", count: 2 },
  ],
  positions,
  step,
);

const meta = {
  title: "Charts/Primitives/CategoryGroupAxis",
  component: CategoryGroupAxis,
  tags: ["autodocs"],
  args: { spans, offset: 28 },
  argTypes: { spans: { control: "object" }, offset: { control: { type: "number", min: 0 } } },
  render: (args) => (
    <svg
      role="img"
      aria-label="Eje de categorías agrupadas"
      width={step * categories.length}
      height={90}
      className="max-w-full"
    >
      <title>Eje de categorías agrupadas</title>
      <line
        x1={0}
        x2={step * categories.length}
        y1={20}
        y2={20}
        strokeWidth={1}
        style={{ stroke: "var(--line)" }}
      />
      {categories.map((name, index) => (
        <text
          key={name}
          x={positions[index]}
          y={16}
          textAnchor="middle"
          className="text-[11px]"
          style={{ fill: "var(--ink-3)" }}
        >
          {name}
        </text>
      ))}
      <CategoryGroupAxis {...args} />
    </svg>
  ),
} satisfies Meta<typeof CategoryGroupAxis>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Bracket and label per group, placed below the category labels. */
export const Default: Story = {};

/** Labels that do not fit their bracket are truncated, then dropped. */
export const Narrow: Story = {
  args: {
    spans: categoryGroupSpans(
      [
        { label: "Servicios básicos de la barbería", count: 2 },
        { label: "Tratamientos de color", count: 1 },
        { label: "X", count: 5 },
      ],
      positions,
      step,
    ),
  },
};
