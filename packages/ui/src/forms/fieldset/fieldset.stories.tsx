import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Field } from "../field/index.js";
import { Input } from "../input/index.js";
import { Fieldset } from "./fieldset.js";

const meta = {
  title: "Forms/Fieldset",
  component: Fieldset,
  tags: ["autodocs"],
  args: { legend: "Apoderado", description: "Quien firma la matrícula.", children: null },
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Fieldset>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Fieldset {...args}>
      <Field label="Nombre">
        <Input />
      </Field>
      <Field label="DNI">
        <Input inputMode="numeric" />
      </Field>
    </Fieldset>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("group", { name: "Apoderado" })).toBeVisible();
  },
};

export const Disabled: Story = { ...Default, args: { disabled: true } };
