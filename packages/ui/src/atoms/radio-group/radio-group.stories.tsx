import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { RadioGroup } from "./radio-group.js";

const options = [
  { value: "efectivo", label: "Efectivo", description: "Pago en caja" },
  { value: "yape", label: "Yape", description: "Escanea el QR" },
  { value: "tarjeta", label: "Tarjeta", description: "Visa / Mastercard" },
];

const meta = {
  title: "Atoms/RadioGroup",
  component: RadioGroup,
  tags: ["autodocs"],
  args: { options, defaultValue: "efectivo", "aria-label": "Método de pago" },
  argTypes: {
    options: { control: "object" },
    defaultValue: { control: "inline-radio", options: options.map((o) => o.value) },
    value: { control: false },
    disabled: { control: "boolean" },
    required: { control: "boolean" },
    onValueChange: { control: false },
  },
} satisfies Meta<typeof RadioGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutDescriptions: Story = {
  args: {
    options: [
      { value: "corte", label: "Corte clásico" },
      { value: "barba", label: "Barba" },
      { value: "combo", label: "Combo corte + barba" },
    ],
    defaultValue: "combo",
    "aria-label": "Servicio",
  },
};

export const Disabled: Story = { args: { disabled: true } };

function ControlledDemo() {
  const [value, setValue] = useState("yape");
  return (
    <div className="grid gap-3">
      <RadioGroup
        aria-label="Método de pago"
        options={options}
        value={value}
        onValueChange={setValue}
      />
      <p className="text-ink-2 text-meta">Seleccionado: {value}</p>
    </div>
  );
}

export const Controlled: Story = { render: () => <ControlledDemo /> };
