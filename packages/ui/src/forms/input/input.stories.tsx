import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "./input.js";

const meta = {
  title: "Forms/Input",
  component: Input,
  tags: ["autodocs"],
  args: { placeholder: "Ej. Marco Salazar", "aria-label": "Nombre del cliente" },
  argTypes: {
    type: { control: "inline-radio", options: ["text", "email", "tel", "number", "password"] },
    placeholder: { control: "text" },
    disabled: { control: "boolean" },
    readOnly: { control: "boolean" },
    "aria-invalid": { control: "boolean" },
  },
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithValue: Story = { args: { defaultValue: "Marco Salazar" } };

export const Telephone: Story = {
  args: { type: "tel", placeholder: "987 654 321", "aria-label": "Teléfono" },
};

export const Invalid: Story = { args: { defaultValue: "marco@", "aria-invalid": true } };

export const Disabled: Story = { args: { disabled: true, defaultValue: "Diego Quispe" } };

export const ReadOnly: Story = { args: { readOnly: true, defaultValue: "S/ 35.00" } };
