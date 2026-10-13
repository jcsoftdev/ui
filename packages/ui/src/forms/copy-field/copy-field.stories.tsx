import type { Meta, StoryObj } from "@storybook/react-vite";
import { CopyField } from "./copy-field.js";

const meta = {
  title: "Forms/CopyField",
  component: CopyField,
  tags: ["autodocs"],
  args: { label: "URL del webhook", value: "https://api.example.com/webhooks/9f2c1" },
  argTypes: {
    label: { control: "text" },
    value: { control: "text" },
    copyLabel: { control: "text" },
    copiedLabel: { control: "text" },
    onCopy: { action: "copy" },
  },
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CopyField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SpanishLabels: Story = { args: { copyLabel: "Copiar", copiedLabel: "Copiado" } };
