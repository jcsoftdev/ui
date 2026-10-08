import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Checkbox } from "./checkbox.js";

const meta = {
  title: "Atoms/Checkbox",
  component: Checkbox,
  tags: ["autodocs"],
  args: { "aria-label": "Cita completada" },
  argTypes: {
    defaultChecked: { control: "boolean" },
    disabled: { control: "boolean" },
    required: { control: "boolean" },
    checked: { control: false },
    onCheckedChange: { control: false },
    "aria-label": { control: "text" },
  },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Checked: Story = { args: { defaultChecked: true } };

export const Disabled: Story = { args: { disabled: true } };

export const DisabledChecked: Story = { args: { disabled: true, defaultChecked: true } };

function ChecklistDemo() {
  const [done, setDone] = useState<Record<string, boolean>>({ corte: true });
  const tasks = [
    { id: "corte", label: "Corte clásico - Marco Ríos" },
    { id: "barba", label: "Perfilado de barba - Lucho Vargas" },
    { id: "cobro", label: "Cobrar S/ 35 - Andrés Paredes" },
  ];
  return (
    <ul className="grid gap-1">
      {tasks.map((task) => (
        <li key={task.id} className="flex items-center gap-1 text-body">
          <Checkbox
            aria-label={task.label}
            checked={!!done[task.id]}
            onCheckedChange={(v) => setDone((d) => ({ ...d, [task.id]: v === true }))}
          />
          {task.label}
        </li>
      ))}
    </ul>
  );
}

export const ControlledChecklist: Story = { render: () => <ChecklistDemo /> };
