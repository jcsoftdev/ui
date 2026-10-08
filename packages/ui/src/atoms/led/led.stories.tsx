import type { Meta, StoryObj } from "@storybook/react-vite";
import { Led } from "./led.js";

const meta = {
  title: "Atoms/Led",
  component: Led,
  tags: ["autodocs"],
  args: { status: "success", label: "Barbero disponible", showLabel: true },
  argTypes: {
    status: { control: "inline-radio", options: ["success", "warning", "danger", "idle"] },
    label: { control: "text" },
    showLabel: { control: "boolean" },
  },
} satisfies Meta<typeof Led>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Warning: Story = { args: { status: "warning", label: "Atrasado 10 min" } };

export const Danger: Story = { args: { status: "danger", label: "Caja desconectada" } };

export const Idle: Story = { args: { status: "idle", label: "Sin actividad" } };

export const LabelHidden: Story = { args: { showLabel: false } };

export const AllStatuses: Story = {
  render: (args) => (
    <div className="flex flex-col gap-2 text-body">
      <Led {...args} status="success" label="En silla" />
      <Led {...args} status="warning" label="En descanso" />
      <Led {...args} status="danger" label="Ausente" />
      <Led {...args} status="idle" label="Fuera de turno" />
    </div>
  ),
};
