import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { TimeInput } from "./time-input.js";

const meta = {
  title: "Forms/TimeInput",
  component: TimeInput,
  tags: ["autodocs"],
  args: { "aria-label": "Hora de la cita", defaultValue: "15:30", step: 5 },
  argTypes: {
    value: { control: "text" },
    defaultValue: { control: "text" },
    step: { control: "number" },
    placeholder: { control: "text" },
    disabled: { control: "boolean" },
    "aria-invalid": { control: "boolean" },
    onValueChange: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="max-w-40">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TimeInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = { args: { defaultValue: "" } };

export const Step15: Story = { args: { step: 15 } };

export const Invalid: Story = { args: { "aria-invalid": true } };

export const Disabled: Story = { args: { disabled: true } };

export const Controlled: Story = {
  render: (args) => {
    const [hora, setHora] = useState("09:00");
    return (
      <div className="flex flex-col gap-2">
        <TimeInput {...args} defaultValue={undefined} value={hora} onValueChange={setHora} />
        <p className="text-ink-3 text-meta">Apertura: {hora || "sin definir"}</p>
      </div>
    );
  },
};
