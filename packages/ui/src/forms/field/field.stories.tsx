import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { Input } from "../input/index.js";
import { NumberStepper } from "../number-stepper/index.js";
import { Select } from "../select/index.js";
import { Textarea } from "../textarea/index.js";
import { Field } from "./field.js";

const meta = {
  title: "Forms/Field",
  component: Field,
  tags: ["autodocs"],
  args: {
    label: "Nombre del cliente",
    hint: "Como aparecerá en la agenda",
    children: <Input placeholder="Ej. Marco Salazar" />,
  },
  argTypes: {
    label: { control: "text" },
    hint: { control: "text" },
    error: { control: "text" },
    optional: { control: "boolean" },
    required: { control: "boolean" },
    disabled: { control: "boolean" },
    id: { control: "text" },
    children: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithError: Story = {
  args: { hint: undefined, error: "Ingresa el nombre del cliente" },
};

export const HintAndError: Story = {
  args: { label: "Teléfono", hint: "9 dígitos", error: "El teléfono debe tener 9 dígitos" },
};

export const Optional: Story = {
  args: { label: "Correo", hint: "Para enviarte el comprobante", optional: true },
};

export const WithSelect: Story = {
  args: {
    label: "Barbero",
    hint: undefined,
    children: (
      <Select>
        <option>Diego Quispe</option>
        <option>Luis Paredes</option>
      </Select>
    ),
  },
};

export const WithTextarea: Story = {
  args: { label: "Notas", hint: "Visible solo para el equipo", children: <Textarea /> },
};

export const ControlledForm: Story = {
  render: () => {
    const [name, setName] = useState("");
    const [servicio, setServicio] = useState("corte");
    const [notas, setNotas] = useState("");
    const error = name.trim().length === 0 ? "Ingresa el nombre del cliente" : undefined;
    return (
      <form className="flex max-w-sm flex-col gap-3.5" onSubmit={(e) => e.preventDefault()}>
        <Field label="Cliente" error={error}>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Servicio" hint="Corte clásico S/ 25, Corte + barba S/ 40">
          <Select value={servicio} onChange={(e) => setServicio(e.target.value)}>
            <option value="corte">Corte clásico - S/ 25</option>
            <option value="barba">Perfilado de barba - S/ 20</option>
            <option value="combo">Corte + barba - S/ 40</option>
          </Select>
        </Field>
        <Field label="Notas">
          <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} />
        </Field>
      </form>
    );
  },
};

export const NodeLabelAndSeveralChildren: Story = {
  args: {
    label: (
      <>
        Teléfono <span aria-hidden="true">*</span>
      </>
    ),
    hint: "Con código de país",
    error: "Número inválido",
    children: (
      <div className="flex items-center gap-2">
        <span className="text-ink-3">+51</span>
        <Input placeholder="999 999 999" />
      </div>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = await canvas.findByRole("textbox", { name: /Teléfono/ });
    // Label, description and invalid state reach the first control inside the wrapper.
    await expect(input).toHaveAccessibleDescription("Con código de país Número inválido");
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await userEvent.click(canvas.getByText(/Teléfono/));
    await expect(input).toHaveFocus();
  },
};

export const ExplicitControlId: Story = {
  args: {
    label: "Cantidad",
    hint: "Entre 1 y 10",
    controlId: "qty-control",
    children: [
      <NumberStepper key="n" id="qty-control" min={1} max={10} />,
      <span key="s" className="text-ink-3 text-meta">
        unidades
      </span>,
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const control = await canvas.findByRole("spinbutton", { name: "Cantidad" });
    await expect(control).toHaveAttribute("id", "qty-control");
    await expect(control).toHaveAccessibleDescription("Entre 1 y 10");
  },
};

export const Required: Story = {
  args: { label: "Nombre del cliente", required: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const control = await canvas.findByRole("textbox", { name: /Nombre del cliente/ });
    await expect(control).toHaveAttribute("aria-required", "true");
  },
};

export const Disabled: Story = {
  args: { label: "Código", hint: "Lo asigna el sistema", disabled: true },
};
