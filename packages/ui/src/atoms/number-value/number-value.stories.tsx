import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { NumberValue } from "./number-value.js";

const meta = {
  title: "Atoms/NumberValue",
  component: NumberValue,
  tags: ["autodocs"],
  args: { value: 12840, duration: 900, format: { style: "currency", currency: "PEN" } },
  argTypes: {
    value: { control: "number" },
    duration: { control: { type: "number", min: 0, step: 100 } },
    from: { control: "number" },
    animateOnMount: { control: "boolean" },
    format: { control: "object" },
  },
  decorators: [
    (Story) => (
      <div className="text-kpi-number text-ink">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof NumberValue>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Percent: Story = {
  args: { value: 0.784, format: { style: "percent", maximumFractionDigits: 1 } },
};

export const Compact: Story = {
  args: { value: 1250000, format: { notation: "compact", maximumFractionDigits: 1 } },
};

/** Changing `value` animates from the number currently shown. */
export const Updating: Story = {
  render: function Render(args) {
    const [value, setValue] = useState(840);
    return (
      <div className="flex flex-col gap-3">
        <NumberValue {...args} value={value} />
        <button
          type="button"
          className="h-control w-fit cursor-pointer rounded-button bg-accent px-control-x text-control text-on-accent"
          onClick={() => setValue((v) => v + 360)}
        >
          Registrar venta
        </button>
      </div>
    );
  },
};

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="@container/page w-[320px] max-w-full">
        <Story />
      </div>
    ),
  ],
};

export const BrutalPreset: Story = {
  decorators: [
    (Story) => (
      <div data-style="brutal" className="bg-surface-card p-card">
        <Story />
      </div>
    ),
  ],
};
