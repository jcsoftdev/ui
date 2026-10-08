import type { Meta, StoryObj } from "@storybook/react-vite";
import { ObservationDots } from "./observations.js";

const values = [18, 22, 25, 27, 30, 31, 33, 35, 35, 38, 40, 44, 52, 61];
const points = values.map((value, index) => ({ value, offset: ((index * 7) % 13) - 6 }));
const map = (value: number) => 20 + (value / 70) * 260;

const meta = {
  title: "Charts/Primitives/ObservationDots",
  component: ObservationDots,
  tags: ["autodocs"],
  args: {
    points,
    map,
    center: 40,
    horizontal: true,
    color: "var(--chart-cat-1)",
    coloring: "series",
    radius: 2.6,
  },
  argTypes: {
    points: { control: false },
    map: { control: false },
    coloring: { control: "inline-radio", options: ["series", "value"] },
    horizontal: { control: "boolean" },
    dimmed: { control: "boolean" },
  },
  render: (args) => (
    <svg
      viewBox="0 0 300 80"
      role="img"
      aria-label="Duración de cortes en minutos"
      className="w-full max-w-[480px]"
    >
      <title>Duración de cortes en minutos</title>
      <line x1={20} x2={280} y1={40} y2={40} style={{ stroke: "var(--line)" }} />
      <ObservationDots {...args} />
    </svg>
  ),
} satisfies Meta<typeof ObservationDots>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Raw observations jittered across the group axis. */
export const Default: Story = {};

/** The fill grades from pale to the series color across the value range. */
export const GradedByValue: Story = { args: { coloring: "value", range: [18, 61], radius: 4 } };

export const Dimmed: Story = { args: { dimmed: true } };
