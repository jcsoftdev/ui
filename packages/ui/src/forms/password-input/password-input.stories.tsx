import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Field } from "../field/field.js";
import { PasswordInput } from "./password-input.js";

const meta = {
  title: "Forms/PasswordInput",
  component: PasswordInput,
  tags: ["autodocs"],
  args: { "aria-label": "Contraseña", defaultValue: "correcto-caballo" },
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PasswordInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText("Contraseña");
    const toggle = canvas.getByRole("button", { name: "Show password" });
    await expect(input).toHaveAttribute("type", "password");
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(toggle);
    await expect(input).toHaveAttribute("type", "text");
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(toggle);
    await expect(input).toHaveAttribute("type", "password");
  },
};

export const InsideField: Story = {
  args: { "aria-label": undefined },
  render: (args) => (
    <Field label="Contraseña" error="La contraseña no coincide.">
      <PasswordInput {...args} />
    </Field>
  ),
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByLabelText("Contraseña", { selector: "input" });
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(input).toHaveAccessibleDescription("La contraseña no coincide.");
  },
};

export const Revealed: Story = { args: { defaultRevealed: true } };

export const Disabled: Story = { args: { disabled: true } };
