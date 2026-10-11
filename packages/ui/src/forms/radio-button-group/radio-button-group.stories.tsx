import type { Meta, StoryObj } from "@storybook/react-vite";
import { Banknote, CreditCard, Smartphone } from "../../icons/index.js";
import { RadioButtonGroup } from "./radio-button-group.js";

const options = [
  { value: "yape", label: "Yape", description: "Pago inmediato", icon: <Smartphone /> },
  { value: "tarjeta", label: "Tarjeta", description: "Visa / Mastercard", icon: <CreditCard /> },
  { value: "efectivo", label: "Efectivo", description: "Al llegar al local", icon: <Banknote /> },
  { value: "plin", label: "Plin", description: "No disponible hoy", disabled: true },
];

const meta = {
  title: "Forms/RadioButtonGroup",
  component: RadioButtonGroup,
  tags: ["autodocs"],
  args: { options, defaultValue: "yape", "aria-label": "Método de pago" },
  argTypes: {
    disabled: { control: "boolean" },
    options: { control: false },
    value: { control: false },
    onValueChange: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RadioButtonGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Disabled: Story = { args: { disabled: true } };

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="w-[320px] max-w-full">
        <Story />
      </div>
    ),
  ],
};

export const BrutalPreset: Story = {
  decorators: [
    (Story) => (
      <div data-style="brutal" className="w-full max-w-xl bg-surface p-card">
        <Story />
      </div>
    ),
  ],
};
