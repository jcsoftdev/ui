import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
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

export const FormSubmitAndReset: Story = {
  render: () => (
    <form aria-label="Ajustes">
      <Switch aria-label="Reservas" name="booking" defaultChecked />
      <Switch aria-label="Avisos" name="alerts" value="wa" />
      <button type="reset">Restablecer</button>
    </form>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const form = canvas.getByRole("form") as HTMLFormElement;
    const [booking, alerts] = canvas.getAllByRole("switch");
    await expect(Object.fromEntries(new FormData(form))).toEqual({ booking: "on" });
    await userEvent.click(alerts);
    await userEvent.click(booking);
    await waitFor(() => expect(Object.fromEntries(new FormData(form))).toEqual({ alerts: "wa" }));
    await userEvent.click(canvas.getByRole("button", { name: "Restablecer" }));
    await waitFor(() => expect(booking).toHaveAttribute("aria-checked", "true"));
    await expect(alerts).toHaveAttribute("aria-checked", "false");
    await expect(Object.fromEntries(new FormData(form))).toEqual({ booking: "on" });
  },
};

export const TouchHitArea: Story = {
  render: (args) => (
    <div data-density="touch">
      <Switch {...args} classNames={{ root: "h-6 w-9" }} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const control = within(canvasElement).getByRole("switch");
    const hit = getComputedStyle(control, "::after");
    await expect(hit.position).toBe("absolute");
    await expect(Math.round(Number.parseFloat(hit.width))).toBe(44);
    await expect(Math.round(Number.parseFloat(hit.height))).toBe(44);
  },
};
