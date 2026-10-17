import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
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

export const DisabledItemSkippedByArrows: Story = {
  args: {
    options: [
      { value: "efectivo", label: "Efectivo" },
      { value: "yape", label: "Yape", disabled: true },
      { value: "tarjeta", label: "Tarjeta" },
    ],
  },
  play: async ({ canvasElement }) => {
    const [efectivo, yape, tarjeta] = within(canvasElement).getAllByRole("radio");
    efectivo.focus();
    await userEvent.keyboard("{ArrowDown}");
    await expect(tarjeta).toHaveFocus();
    await waitFor(() => expect(tarjeta).toHaveAttribute("aria-checked", "true"));
    await expect(yape).toHaveAttribute("aria-checked", "false");
  },
};

export const FormSubmitAndReset: Story = {
  render: () => (
    <form aria-label="Pago">
      <RadioGroup aria-label="Método" name="metodo" defaultValue="efectivo" options={options} />
      <button type="reset">Restablecer</button>
    </form>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const form = canvas.getByRole("form") as HTMLFormElement;
    const [efectivo, yape] = canvas.getAllByRole("radio");
    await expect(Object.fromEntries(new FormData(form))).toEqual({ metodo: "efectivo" });
    await userEvent.click(yape);
    await waitFor(() => expect(Object.fromEntries(new FormData(form))).toEqual({ metodo: "yape" }));
    await userEvent.click(canvas.getByRole("button", { name: "Restablecer" }));
    await waitFor(() => expect(efectivo).toHaveAttribute("aria-checked", "true"));
    await expect(Object.fromEntries(new FormData(form))).toEqual({ metodo: "efectivo" });
  },
};

export const NamedFromLabel: Story = {
  render: () => <RadioGroup aria-label="Método" options={options} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const option of options) {
      const radio = canvas.getByRole("radio", { name: option.label });
      await expect(radio).toHaveAccessibleDescription(option.description);
    }
  },
};
