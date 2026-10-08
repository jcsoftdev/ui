import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import type { RangeValue } from "./model.js";
import { type SingleSliderProps, Slider } from "./slider.js";

const meta = {
  title: "Forms/Slider",
  component: Slider,
  tags: ["autodocs"],
  args: { min: 0, max: 100, step: 5, defaultValue: 40, "aria-label": "Descuento" },
  argTypes: {
    min: { control: "number" },
    max: { control: "number" },
    step: { control: "number" },
    disabled: { control: "boolean" },
    showValue: { control: "boolean" },
    value: { control: false },
    defaultValue: { control: false },
    marks: { control: false },
    formatValue: { control: false },
    onValueChange: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-md px-3">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<SingleSliderProps>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { showValue: true, formatValue: (v) => `${v} %` },
};

export const WithMarks: Story = {
  args: {
    min: 0,
    max: 120,
    step: 15,
    defaultValue: 45,
    "aria-label": "Duración del servicio",
    marks: [
      { value: 0, label: "0" },
      { value: 30, label: "30 min" },
      { value: 60, label: "1 h" },
      { value: 90, label: "1 h 30" },
      { value: 120, label: "2 h" },
    ],
    formatValue: (v) => `${v} min`,
  },
};

const rangeProps = {
  min: 0,
  max: 200,
  step: 10,
  defaultValue: [30, 120] as RangeValue,
  "aria-label": "Precio",
  showValue: true,
  minGap: 20,
  formatValue: (v: number) => `S/ ${v}`,
};

export const Range: Story = { render: () => <Slider {...rangeProps} /> };

export const Disabled: Story = { args: { disabled: true } };

function Controlled() {
  const [value, setValue] = useState(25);
  return (
    <div className="flex flex-col gap-density">
      <Slider
        min={0}
        max={50}
        step={5}
        value={value}
        onValueChange={setValue}
        aria-label="Propina"
      />
      <p className="text-ink-2 text-meta">Propina: S/ {value}</p>
    </div>
  );
}

export const ControlledValue: Story = { render: () => <Controlled /> };

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="w-[320px] max-w-full px-3">
        <Story />
      </div>
    ),
  ],
  render: Range.render,
};

export const BrutalPreset: Story = {
  decorators: [
    (Story) => (
      <div data-style="brutal" className="w-full max-w-md bg-surface p-card">
        <Story />
      </div>
    ),
  ],
  render: Range.render,
};
