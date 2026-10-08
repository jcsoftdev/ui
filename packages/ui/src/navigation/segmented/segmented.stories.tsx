import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Segmented, SegmentedItem } from "./segmented.js";

const meta = {
  title: "Navigation/Segmented",
  component: Segmented,
  tags: ["autodocs"],
  args: { defaultValue: "semana", "aria-label": "Vista de agenda" },
  argTypes: {
    defaultValue: { control: "inline-radio", options: ["dia", "semana", "mes"] },
    value: { control: false },
    disabled: { control: "boolean" },
    onValueChange: { control: false },
    children: { control: false },
  },
  render: (args) => (
    <Segmented {...args}>
      <SegmentedItem value="dia">Día</SegmentedItem>
      <SegmentedItem value="semana">Semana</SegmentedItem>
      <SegmentedItem value="mes">Mes</SegmentedItem>
    </Segmented>
  ),
} satisfies Meta<typeof Segmented>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Disabled: Story = { args: { disabled: true } };

export const TwoOptions: Story = {
  args: { defaultValue: "efectivo", "aria-label": "Método de pago" },
  render: (args) => (
    <Segmented {...args}>
      <SegmentedItem value="efectivo">Efectivo</SegmentedItem>
      <SegmentedItem value="yape">Yape</SegmentedItem>
    </Segmented>
  ),
};

export const OneItemDisabled: Story = {
  render: (args) => (
    <Segmented {...args}>
      <SegmentedItem value="dia">Día</SegmentedItem>
      <SegmentedItem value="semana">Semana</SegmentedItem>
      <SegmentedItem value="mes" disabled>
        Mes
      </SegmentedItem>
    </Segmented>
  ),
};

function ControlledDemo() {
  const [value, setValue] = useState("semana");
  return (
    <div className="grid gap-3">
      <Segmented aria-label="Vista de agenda" value={value} onValueChange={setValue}>
        <SegmentedItem value="dia">Día</SegmentedItem>
        <SegmentedItem value="semana">Semana</SegmentedItem>
        <SegmentedItem value="mes">Mes</SegmentedItem>
      </Segmented>
      <p className="text-ink-2 text-meta">Vista: {value || "ninguna"}</p>
    </div>
  );
}

export const Controlled: Story = { render: () => <ControlledDemo /> };
