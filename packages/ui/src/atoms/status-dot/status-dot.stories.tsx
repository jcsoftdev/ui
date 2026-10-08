import type { Meta, StoryObj } from "@storybook/react-vite";
import { StatusDot } from "./status-dot.js";

const meta = {
  title: "Atoms/StatusDot",
  component: StatusDot,
  tags: ["autodocs"],
  args: { tone: "success", label: "Pagado", showLabel: true, shape: "dot" },
  argTypes: {
    tone: {
      control: "select",
      options: ["danger", "warning", "success", "accent", "neutral"],
    },
    shape: { control: "inline-radio", options: ["dot", "square"] },
    label: { control: "text" },
    showLabel: { control: "boolean" },
    hollow: { control: "boolean" },
  },
} satisfies Meta<typeof StatusDot>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Square: Story = { args: { shape: "square", tone: "warning", label: "Pendiente" } };

export const Hollow: Story = { args: { hollow: true, tone: "accent", label: "Reservada" } };

export const LabelHidden: Story = { args: { showLabel: false } };

export const AllTones: Story = {
  render: (args) => (
    <div className="flex flex-col gap-2 text-body">
      <StatusDot {...args} tone="success" label="Completada" />
      <StatusDot {...args} tone="warning" label="En espera" />
      <StatusDot {...args} tone="danger" label="Cancelada" />
      <StatusDot {...args} tone="accent" label="En curso" />
      <StatusDot {...args} tone="neutral" label="Sin asignar" />
    </div>
  ),
};
