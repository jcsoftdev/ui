import type { Meta, StoryObj } from "@storybook/react-vite";
import { BigDate } from "./big-date.js";

const meta = {
  title: "Atoms/BigDate",
  component: BigDate,
  tags: ["autodocs"],
  args: { children: "Mié 8 oct", size: "normal" },
  argTypes: {
    size: { control: "inline-radio", options: ["normal", "compact"] },
    children: { control: "text" },
  },
} satisfies Meta<typeof BigDate>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Compact: Story = { args: { size: "compact" } };

export const AsAmount: Story = { args: { children: "S/ 1 240" } };

export const InCard: Story = {
  render: (args) => (
    <div className="max-w-xs rounded-lg border border-line bg-surface p-4">
      <p className="text-ink-3 text-meta">Próxima cita</p>
      <BigDate {...args}>Hoy, 4:30 pm</BigDate>
      <p className="text-ink-2 text-meta">Corte clásico con Diego Quispe</p>
    </div>
  ),
};
