import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ColorRange } from "../../core/color-scale.js";
import { MapLegend } from "./map-legend.js";

const soles = (value: number) => `S/ ${Math.round(value).toLocaleString("es-PE")}`;

const ranges: ColorRange[] = [
  { to: 5000, label: "Menos de S/ 5,000", tone: "neutral" },
  { from: 5000, to: 15000, label: "S/ 5,000 a 15,000", tone: "accent" },
  { from: 15000, label: "Más de S/ 15,000", tone: "success" },
];

const meta = {
  title: "Charts/Primitives/MapLegend",
  component: MapLegend,
  tags: ["autodocs"],
  args: { kind: "sequential", domain: [0, 24000], format: soles, noData: "Sin sedes" },
  argTypes: {
    kind: { control: "inline-radio", options: ["sequential", "diverging"] },
    domain: { control: "object" },
    center: { control: "number" },
    noData: { control: "text" },
    colors: { control: "object" },
    ranges: { control: "object" },
    format: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="@container/chart w-[480px] max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MapLegend>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Sequential: Story = {};

export const Diverging: Story = {
  args: {
    kind: "diverging",
    domain: [-30, 30],
    center: 0,
    format: (value) => `${value}%`,
    noData: undefined,
  },
};

export const SteppedRanges: Story = { args: { ranges } };
