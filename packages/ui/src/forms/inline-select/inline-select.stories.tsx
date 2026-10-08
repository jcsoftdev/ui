import type { Meta, StoryObj } from "@storybook/react-vite";
import { InlineSelect } from "./inline-select.js";

const options = [
  { value: "dia", label: "día" },
  { value: "semana", label: "semana" },
  { value: "mes", label: "mes" },
];

const meta = {
  title: "Forms/InlineSelect",
  component: InlineSelect,
  tags: ["autodocs"],
  args: { options, defaultValue: "semana", "aria-label": "Frecuencia" },
  argTypes: { disabled: { control: "boolean" }, options: { control: false } },
  render: (args) => (
    <p className="flex flex-wrap items-center gap-x-1 text-body text-ink">
      Repetir la cita cada <InlineSelect {...args} /> con el mismo barbero.
    </p>
  ),
} satisfies Meta<typeof InlineSelect>;

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
      <div data-style="brutal" className="bg-surface p-card">
        <Story />
      </div>
    ),
  ],
};
