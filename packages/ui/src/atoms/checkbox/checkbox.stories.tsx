import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
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

export const Indeterminate: Story = {
  args: { defaultChecked: "indeterminate" },
  play: async ({ canvasElement }) => {
    const box = within(canvasElement).getByRole("checkbox");
    await expect(box).toHaveAttribute("aria-checked", "mixed");
    await expect(box).toHaveAttribute("data-state", "indeterminate");
    await userEvent.click(box);
    await expect(box).toHaveAttribute("aria-checked", "true");
  },
};

export const EnterDoesNotToggle: Story = {
  play: async ({ canvasElement }) => {
    const box = within(canvasElement).getByRole("checkbox");
    box.focus();
    await userEvent.keyboard("{Enter}");
    await expect(box).toHaveAttribute("aria-checked", "false");
    await userEvent.keyboard(" ");
    await expect(box).toHaveAttribute("aria-checked", "true");
  },
};

export const FormSubmitAndReset: Story = {
  render: () => (
    <form aria-label="Preferencias">
      <Checkbox aria-label="Acepto" name="terms" value="si" defaultChecked />
      <Checkbox aria-label="Boletín" name="news" />
      <button type="reset">Restablecer</button>
    </form>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const form = canvas.getByRole("form") as HTMLFormElement;
    const [terms, news] = canvas.getAllByRole("checkbox");
    await expect(Object.fromEntries(new FormData(form))).toEqual({ terms: "si" });
    await userEvent.click(news);
    await userEvent.click(terms);
    await waitFor(() => expect(Object.fromEntries(new FormData(form))).toEqual({ news: "on" }));
    await userEvent.click(canvas.getByRole("button", { name: "Restablecer" }));
    await waitFor(() => expect(terms).toHaveAttribute("aria-checked", "true"));
    await expect(news).toHaveAttribute("aria-checked", "false");
    await expect(Object.fromEntries(new FormData(form))).toEqual({ terms: "si" });
  },
};
