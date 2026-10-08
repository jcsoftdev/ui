import type { Meta, StoryObj } from "@storybook/react-vite";
import { Scissors, Smile, Sparkles } from "lucide-react";
import { CheckboxButtonGroup } from "./checkbox-button-group.js";

const options = [
  { value: "corte", label: "Corte", description: "S/ 35 · 30 min", icon: <Scissors /> },
  { value: "barba", label: "Barba", description: "S/ 25 · 20 min", icon: <Smile /> },
  { value: "facial", label: "Limpieza facial", description: "S/ 40 · 25 min", icon: <Sparkles /> },
  { value: "cejas", label: "Cejas", description: "S/ 10 · 10 min", disabled: true },
];

const meta = {
  title: "Forms/CheckboxButtonGroup",
  component: CheckboxButtonGroup,
  tags: ["autodocs"],
  args: { options, defaultValue: ["corte"], "aria-label": "Servicios" },
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
} satisfies Meta<typeof CheckboxButtonGroup>;

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
