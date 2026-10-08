import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { NumberStepper } from "./number-stepper.js";

const meta = {
  title: "Forms/NumberStepper",
  component: NumberStepper,
  tags: ["autodocs"],
  args: { defaultValue: 2, min: 0, max: 10, step: 1, "aria-label": "Cantidad de productos" },
  argTypes: {
    min: { control: "number" },
    max: { control: "number" },
    step: { control: "number" },
    disabled: { control: "boolean" },
    unit: { control: "text" },
    value: { control: false },
    onValueChange: { control: false },
  },
} satisfies Meta<typeof NumberStepper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithUnit: Story = {
  args: { defaultValue: 30, min: 15, max: 120, step: 15, unit: "min", "aria-label": "Duración" },
};

export const Decimals: Story = {
  args: { defaultValue: 35, min: 0, step: 0.5, max: 500, unit: "S/", "aria-label": "Precio" },
};

export const Disabled: Story = { args: { disabled: true } };

function Controlled() {
  const [qty, setQty] = useState(3);
  return (
    <div className="flex flex-wrap items-center gap-density">
      <NumberStepper value={qty} onValueChange={setQty} min={1} max={20} aria-label="Pomadas" />
      <span className="text-ink-2 text-meta">Total: S/ {qty * 45}</span>
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
  args: WithUnit.args,
};

export const BrutalPreset: Story = {
  decorators: [
    (Story) => (
      <div data-style="brutal" className="bg-surface p-card">
        <Story />
      </div>
    ),
  ],
  args: WithUnit.args,
};

/** A shrink-wrapped flex parent gives the stepper its intrinsic width without a caller width. */
export const InShrinkWrapRow: Story = {
  render: (args) => (
    <div className="flex w-fit items-center gap-3 rounded-card border-card p-3">
      <span className="text-body text-ink">Productos</span>
      <NumberStepper {...args} />
    </div>
  ),
  args: WithUnit.args,
};
