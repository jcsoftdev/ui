import type { Meta, StoryObj } from "@storybook/react-vite";
import { Field } from "../field/index.js";
import { Input } from "../input/index.js";
import { Select } from "../select/index.js";
import { Textarea } from "../textarea/index.js";
import { TimeInput } from "../time-input/index.js";
import { FormGrid, FormGridItem } from "./form-grid.js";

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

export const Narrow: Story = {
  render: Default.render,
  decorators: [
    (Story) => (
      <div className="@container w-80 max-w-full">
        <Story />
      </div>
    ),
  ],
};

export const ThreeColumns: Story = {
  decorators: [
    (Story) => (
      <div className="max-w-4xl">
        <Story />
      </div>
    ),
  ],
  render: (args) => (
    <FormGrid {...args} columns={3}>
      <Field label="Nombre">
        <Input />
      </Field>
      <Field label="Apellido">
        <Input />
      </Field>
      <Field label="Teléfono">
        <Input type="tel" />
      </Field>
      <FormGridItem span={2}>
        <Field label="Dirección">
          <Input />
        </Field>
      </FormGridItem>
      <Field label="Distrito">
        <Input />
      </Field>
      <FormGridItem span="full">
        <Field label="Notas">
          <Textarea />
        </Field>
      </FormGridItem>
    </FormGrid>
  ),
};

export const SingleColumn: Story = {
  render: (args) => (
    <FormGrid {...args} columns={1}>
      <Field label="Nombre">
        <Input />
      </Field>
      <Field label="Apellido">
        <Input />
      </Field>
    </FormGrid>
  ),
};
