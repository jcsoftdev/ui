import type { Meta, StoryObj } from "@storybook/react-vite";
import { Field } from "../field/index.js";
import { Input } from "../input/index.js";
import { Select } from "../select/index.js";
import { Textarea } from "../textarea/index.js";
import { TimeInput } from "../time-input/index.js";
import { FormGrid } from "./form-grid.js";

const meta = {
  title: "Forms/FormGrid",
  component: FormGrid,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FormGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <FormGrid {...args}>
      <Field label="Nombre">
        <Input placeholder="Marco" />
      </Field>
      <Field label="Apellido">
        <Input placeholder="Salazar" />
      </Field>
      <Field label="Teléfono">
        <Input type="tel" placeholder="987 654 321" />
      </Field>
      <Field label="Barbero">
        <Select>
          <option>Diego Quispe</option>
          <option>Luis Paredes</option>
        </Select>
      </Field>
    </FormGrid>
  ),
};

export const NewAppointment: Story = {
  render: (args) => (
    <FormGrid {...args}>
      <Field label="Cliente" error="Selecciona un cliente">
        <Input />
      </Field>
      <Field label="Servicio">
        <Select>
          <option>Corte clásico - S/ 25</option>
          <option>Corte + barba - S/ 40</option>
        </Select>
      </Field>
      <Field label="Hora de inicio">
        <TimeInput defaultValue="15:30" />
      </Field>
      <Field label="Hora de fin">
        <TimeInput defaultValue="16:15" />
      </Field>
      <Field label="Notas" className="col-span-full">
        <Textarea />
      </Field>
    </FormGrid>
  ),
};
