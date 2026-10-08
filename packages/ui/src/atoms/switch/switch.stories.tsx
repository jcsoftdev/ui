import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Switch } from "./switch.js";

const meta = {
  title: "Atoms/Switch",
  component: Switch,
  tags: ["autodocs"],
  args: { "aria-label": "Recordatorios por WhatsApp" },
  argTypes: {
    defaultChecked: { control: "boolean" },
    disabled: { control: "boolean" },
    required: { control: "boolean" },
    checked: { control: false },
    onCheckedChange: { control: false },
    "aria-label": { control: "text" },
  },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const On: Story = { args: { defaultChecked: true } };

export const Disabled: Story = { args: { disabled: true } };

export const DisabledOn: Story = { args: { disabled: true, defaultChecked: true } };

function SettingDemo() {
  const [on, setOn] = useState(true);
  return (
    <div className="flex items-center gap-2 text-body">
      <Switch aria-label="Aceptar reservas en línea" checked={on} onCheckedChange={setOn} />
      Aceptar reservas en línea ({on ? "activado" : "desactivado"})
    </div>
  );
}

export const Controlled: Story = { render: () => <SettingDemo /> };
