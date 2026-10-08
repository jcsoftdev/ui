import type { Meta, StoryObj } from "@storybook/react-vite";
import { TextShimmer } from "./text-shimmer.js";

const meta = {
  title: "AI/TextShimmer",
  component: TextShimmer,
  tags: ["autodocs"],
  args: { children: "Revisando la agenda de hoy…", duration: 2 },
  argTypes: {
    children: { control: "text" },
    duration: { control: { type: "number", min: 0.5, max: 6, step: 0.5 } },
    as: { control: false },
  },
} satisfies Meta<typeof TextShimmer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Narrow: Story = {
  args: { children: "Buscando huecos libres entre los turnos del sábado por la mañana…" },
  decorators: [
    (Story) => (
      <div className="w-[320px]">
        <Story />
      </div>
    ),
  ],
};

export const PresetBrutal: Story = {
  decorators: [
    (Story) => (
      <div data-style="brutal" className="bg-bg p-card text-body">
        <Story />
      </div>
    ),
  ],
};
