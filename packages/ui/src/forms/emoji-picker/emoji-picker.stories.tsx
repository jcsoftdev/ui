import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { EmojiPicker } from "./emoji-picker.js";

const meta = {
  title: "Forms/EmojiPicker",
  component: EmojiPicker,
  tags: ["autodocs"],
  args: { searchPlaceholder: "Buscar emoji" },
  argTypes: {
    searchPlaceholder: { control: "text" },
    categories: { control: false },
    onSelect: { control: false },
  },
} satisfies Meta<typeof EmojiPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

function WithPreview(props: { className?: string }) {
  const [picked, setPicked] = useState("✂️");
  return (
    <div className="flex flex-col gap-density">
      <p className="text-body text-ink">
        Reacción para la cita de Diego: <span className="text-xl">{picked}</span>
      </p>
      <EmojiPicker onSelect={setPicked} {...props} />
    </div>
  );
}

export const Default: Story = { render: () => <WithPreview /> };

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="w-[320px] max-w-full">
        <Story />
      </div>
    ),
  ],
  render: () => <WithPreview />,
};

export const BrutalPreset: Story = {
  decorators: [
    (Story) => (
      <div data-style="brutal" className="bg-surface p-card">
        <Story />
      </div>
    ),
  ],
  render: () => <WithPreview />,
};
