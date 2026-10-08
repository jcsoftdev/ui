import type { Meta, StoryObj } from "@storybook/react-vite";
import { MessageActions } from "./message-actions.js";

const meta = {
  title: "AI/MessageActions",
  component: MessageActions,
  tags: ["autodocs"],
  args: {
    text: "Tienes tres huecos libres mañana: 10:00, 11:30 y 16:00.",
    onRegenerate: () => {},
    onFeedback: () => {},
    onCopy: () => {},
  },
  argTypes: {
    text: { control: "text" },
    feedback: { control: "inline-radio", options: [null, "like", "dislike"] },
    onRegenerate: { control: false },
    onFeedback: { control: false },
    onCopy: { control: false },
  },
} satisfies Meta<typeof MessageActions>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Liked: Story = { args: { defaultFeedback: "like" } };

export const CopyOnly: Story = { args: { onRegenerate: undefined, onFeedback: undefined } };

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="w-[160px]">
        <Story />
      </div>
    ),
  ],
};

export const PresetBrutal: Story = {
  decorators: [
    (Story) => (
      <div data-style="brutal" className="bg-bg p-card">
        <Story />
      </div>
    ),
  ],
};
