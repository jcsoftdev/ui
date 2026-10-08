import type { Meta, StoryObj } from "@storybook/react-vite";
import { NativeSelect } from "./native-select.js";

const options = [
  {
    label: "Sede Miraflores",
    options: [
      { value: "diego", label: "Diego Quispe" },
      { value: "luis", label: "Luis Paredes" },
    ],
  },
  {
    label: "Sede San Isidro",
    options: [
      { value: "marco", label: "Marco Rojas" },
      { value: "andre", label: "André Salas", disabled: true },
    ],
  },
];

const meta = {
  title: "Forms/NativeSelect",
  component: NativeSelect,
  tags: ["autodocs"],
  args: { options, placeholder: "Elige un barbero", "aria-label": "Barbero" },
  argTypes: {
    size: { control: "inline-radio", options: ["sm", "md"] },
    invalid: { control: "boolean" },
    disabled: { control: "boolean" },
    options: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-xs">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof NativeSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Small: Story = { args: { size: "sm", defaultValue: "diego" } };

export const Invalid: Story = { args: { invalid: true } };

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
      <div data-style="brutal" className="w-full max-w-xs bg-surface p-card">
        <Story />
      </div>
    ),
  ],
};
