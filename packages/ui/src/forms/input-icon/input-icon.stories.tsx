import type { Meta, StoryObj } from "@storybook/react-vite";
import { Phone, Search } from "../../icons/index.js";
import { InputIcon } from "./input-icon.js";

const meta = {
  title: "Forms/InputIcon",
  component: InputIcon,
  tags: ["autodocs"],
  args: {
    icon: <Search />,
    placeholder: "Buscar cliente o servicio",
    "aria-label": "Buscar",
  },
  argTypes: {
    icon: { control: false },
    placeholder: { control: "text" },
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
} satisfies Meta<typeof InputIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Telephone: Story = {
  args: { icon: <Phone />, type: "tel", placeholder: "987 654 321", "aria-label": "Teléfono" },
};

export const Invalid: Story = {
  args: { icon: <Phone />, defaultValue: "98765", "aria-invalid": true, "aria-label": "Teléfono" },
};

export const Disabled: Story = { args: { disabled: true } };
