import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Rating } from "./rating.js";

const meta = {
  title: "Forms/Rating",
  component: Rating,
  tags: ["autodocs"],
  args: { defaultValue: 4, max: 5, precision: 1, size: "md", "aria-label": "Valoración del corte" },
  argTypes: {
    max: { control: { type: "number", min: 1, max: 10 } },
    precision: { control: "inline-radio", options: [0.5, 1] },
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
    readOnly: { control: "boolean" },
    disabled: { control: "boolean" },
    showValue: { control: "boolean" },
    value: { control: false },
    onValueChange: { control: false },
  },
} satisfies Meta<typeof Rating>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const HalfStars: Story = { args: { precision: 0.5, defaultValue: 3.5, showValue: true } };

export const ReadOnly: Story = {
  args: {
    readOnly: true,
    value: 4.5,
    precision: 0.5,
    showValue: true,
    "aria-label": "Diego Quispe",
  },
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-col gap-density">
      <Rating {...args} size="sm" />
      <Rating {...args} size="md" />
      <Rating {...args} size="lg" />
    </div>
  ),
};

function Controlled() {
  const [value, setValue] = useState(0);
  return (
    <div className="flex flex-wrap items-center gap-density">
      <Rating value={value} onValueChange={setValue} precision={0.5} aria-label="Atención" />
      <span className="text-ink-2 text-meta">{value ? `${value} / 5` : "Sin valorar"}</span>
    </div>
  );
}

export const ControlledValue: Story = { render: () => <Controlled /> };

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="w-[320px] max-w-full">
        <Story />
      </div>
    ),
  ],
  args: { max: 10, size: "md", defaultValue: 7 },
};

export const BrutalPreset: Story = {
  decorators: [
    (Story) => (
      <div data-style="brutal" className="bg-surface p-card">
        <Story />
      </div>
    ),
  ],
};
