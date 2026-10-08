import type { Meta, StoryObj } from "@storybook/react-vite";
import { Select } from "./select.js";

const options = (
  <>
    <option value="">Elige un barbero</option>
    <option value="diego">Diego Quispe</option>
    <option value="luis">Luis Paredes</option>
    <option value="andrea">Andrea Ríos</option>
  </>
);

const meta = {
  title: "Forms/Select",
  component: Select,
  tags: ["autodocs"],
  args: { "aria-label": "Barbero", children: options },
  argTypes: {
    children: { control: false },
    disabled: { control: "boolean" },
    "aria-invalid": { control: "boolean" },
  },
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithSelection: Story = { args: { defaultValue: "luis" } };

export const Invalid: Story = { args: { "aria-invalid": true } };

export const Disabled: Story = { args: { disabled: true, defaultValue: "diego" } };
