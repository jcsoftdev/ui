import type { Meta, StoryObj } from "@storybook/react-vite";
import { CopyField } from "./copy-field.js";

const meta = {
  title: "Forms/CopyField",
  component: CopyField,
  tags: ["autodocs"],
  args: { label: "Webhook URL", value: "https://example.com/webhooks/8f3a2c9d" },
  argTypes: {
    label: { control: "text" },
    value: { control: "text" },
    copyLabel: { control: "text" },
    copiedLabel: { control: "text" },
    resetDelay: { control: "number" },
  },
  decorators: [
    (Story) => (
      <div className="max-w-lg">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CopyField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
