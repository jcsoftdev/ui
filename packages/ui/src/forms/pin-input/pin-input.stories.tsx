import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { PinInput } from "./pin-input.js";

const meta = {
  title: "Forms/PinInput",
  component: PinInput,
  tags: ["autodocs"],
  args: { length: 4, label: "PIN del barbero" },
  argTypes: {
    length: { control: { type: "number", min: 3, max: 8 } },
    label: { control: "text" },
    value: { control: "text" },
    defaultValue: { control: "text" },
    statusLabel: { control: false },
    onValueChange: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="max-w-60">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PinInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SixDigits: Story = { args: { length: 6 } };

export const Prefilled: Story = { args: { defaultValue: "12" } };

export const SpanishStatus: Story = {
  args: { statusLabel: (entered, length) => `${entered} de ${length} dígitos ingresados` },
};

export const Controlled: Story = {
  render: (args) => {
    const [pin, setPin] = useState("");
    const length = args.length ?? 4;
    return (
      <div className="flex flex-col gap-3">
        <PinInput {...args} value={pin} onValueChange={setPin} />
        <p className="text-center text-ink-3 text-meta">
          {pin.length === length ? "PIN completo" : `Faltan ${length - pin.length}`}
        </p>
      </div>
    );
  },
};
