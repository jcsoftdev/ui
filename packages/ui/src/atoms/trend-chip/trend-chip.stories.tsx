import type { Meta, StoryObj } from "@storybook/react-vite";
import { TrendChip } from "./trend-chip.js";

const meta = {
  title: "Atoms/TrendChip",
  component: TrendChip,
  tags: ["autodocs"],
  args: { value: 12.5, label: "vs. semana pasada" },
  argTypes: {
    value: { control: "number" },
    invert: { control: "boolean" },
    epsilon: { control: "number" },
    label: { control: "text" },
    locale: { control: "text" },
  },
} satisfies Meta<typeof TrendChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Down: Story = { args: { value: -8.2 } };

export const Flat: Story = { args: { value: 0.2, epsilon: 0.5, label: undefined } };

/** Cancelaciones: a drop is good news, so `invert` flips the tone but not the arrow. */
export const LowerIsBetter: Story = {
  args: { value: -15, invert: true, label: "cancelaciones" },
};

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="@container/page w-[320px] max-w-full">
        <Story />
      </div>
    ),
  ],
  args: { label: "vs. el mismo día de la semana pasada, con mucho texto" },
};

export const BrutalPreset: Story = {
  render: (args) => (
    <div data-style="brutal" className="flex flex-wrap gap-density bg-surface-card p-card">
      <TrendChip {...args} />
      <TrendChip {...args} value={-4} />
      <TrendChip {...args} value={0} label={undefined} />
    </div>
  ),
};
