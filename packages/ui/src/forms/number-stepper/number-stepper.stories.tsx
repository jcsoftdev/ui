import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { NumberStepper } from "./number-stepper.js";

const meta = {
  title: "Forms/NumberStepper",
  component: NumberStepper,
  tags: ["autodocs"],
  args: { defaultValue: 2, min: 0, max: 10, step: 1, "aria-label": "Cantidad de productos" },
  argTypes: {
    min: { control: "number" },
    max: { control: "number" },
    step: { control: "number" },
    disabled: { control: "boolean" },
    unit: { control: "text" },
    value: { control: false },
    onValueChange: { control: false },
  },
} satisfies Meta<typeof NumberStepper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithUnit: Story = {
  args: { defaultValue: 30, min: 15, max: 120, step: 15, unit: "min", "aria-label": "Duración" },
};

export const Decimals: Story = {
  args: { defaultValue: 35, min: 0, step: 0.5, max: 500, unit: "S/", "aria-label": "Precio" },
};

export const Disabled: Story = { args: { disabled: true } };

function Controlled() {
  const [qty, setQty] = useState(3);
  return (
    <div className="flex flex-wrap items-center gap-density">
      <NumberStepper value={qty} onValueChange={setQty} min={1} max={20} aria-label="Pomadas" />
      <span className="text-ink-2 text-meta">Total: S/ {qty * 45}</span>
    </div>
  );
}

export const ControlledValue: Story = { render: () => <Controlled /> };

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="w-[320px] max-w-full">
        <Story />
      </div>
    ),
  ],
  args: WithUnit.args,
};

export const BrutalPreset: Story = {
  decorators: [
    (Story) => (
      <div data-style="brutal" className="bg-surface p-card">
        <Story />
      </div>
    ),
  ],
  args: WithUnit.args,
};

/** A shrink-wrapped flex parent gives the stepper its intrinsic width without a caller width. */
export const InShrinkWrapRow: Story = {
  render: (args) => (
    <div className="flex w-fit items-center gap-3 rounded-card border-card p-3">
      <span className="text-body text-ink">Productos</span>
      <NumberStepper {...args} />
    </div>
  ),
  args: WithUnit.args,
};

function StringMode({ onChange }: { onChange: (text: string) => void }) {
  const [text, setText] = useState("");
  return (
    <div className="flex flex-col gap-2">
      <NumberStepper
        mode="string"
        value={text}
        placeholder="0"
        min={1}
        max={5}
        aria-label="Cupos"
        onChange={(event) => {
          setText(event.target.value);
          onChange(event.target.value);
        }}
      />
      <p className="text-ink-3 text-meta">Text: [{text}]</p>
    </div>
  );
}

export const StringModeCallerOwned: Story = {
  args: { onValueChange: undefined },
  render: () => <StringMode onChange={fn()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("spinbutton", { name: "Cupos" });
    await expect(input).toHaveValue("");
    await expect(canvas.getByText("Text: []")).toBeVisible();
    // Empty is a real state: ArrowUp goes to the minimum, the buttons step from there.
    await userEvent.type(input, "{ArrowUp}");
    await expect(canvas.getByText("Text: [1]")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Aumentar" }));
    await expect(canvas.getByText("Text: [2]")).toBeVisible();
    // Typing is never rewritten, not even half-typed text.
    await userEvent.clear(input);
    await expect(canvas.getByText("Text: []")).toBeVisible();
    await userEvent.type(input, "3,5");
    await expect(input).toHaveValue("3,5");
    await userEvent.type(input, "{ArrowDown}");
    await expect(canvas.getByText("Text: [3]")).toBeVisible();
    // The ceiling holds.
    await userEvent.clear(input);
    await userEvent.type(input, "5");
    await expect(canvas.getByRole("button", { name: "Aumentar" })).toBeDisabled();
  },
};

export const StringModeUncontrolledForm: Story = {
  args: { onValueChange: undefined },
  render: () => (
    <form data-testid="form">
      <NumberStepper mode="string" name="seats" defaultValue="4" aria-label="Cupos" max={9} />
    </form>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Aumentar" }));
    const form = canvas.getByTestId("form") as HTMLFormElement;
    await expect(new FormData(form).get("seats")).toBe("5");
  },
};
