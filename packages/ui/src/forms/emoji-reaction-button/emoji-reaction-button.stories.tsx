import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { EmojiReactionBar, EmojiReactionButton, type Reaction } from "./emoji-reaction-button.js";

const meta = {
  title: "Forms/EmojiReactionButton",
  component: EmojiReactionButton,
  tags: ["autodocs"],
  args: { emoji: "🔥", count: 7, reacted: false },
  argTypes: {
    emoji: { control: "text" },
    count: { control: "number" },
    reacted: { control: "boolean" },
    disabled: { control: "boolean" },
    onToggle: { control: false },
  },
} satisfies Meta<typeof EmojiReactionButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Reacted: Story = { args: { reacted: true, count: 8 } };

function Bar({ container }: { container?: HTMLElement | null }) {
  const [reactions, setReactions] = useState<Reaction[]>([
    { emoji: "✂️", count: 12, reacted: true },
    { emoji: "🔥", count: 5 },
    { emoji: "👏", count: 3 },
  ]);
  const react = (emoji: string, reacted: boolean) =>
    setReactions((list) => {
      const found = list.find((r) => r.emoji === emoji);
      if (!found) return [...list, { emoji, count: 1, reacted: true }];
      return list
        .map((r) =>
          r.emoji === emoji ? { ...r, reacted, count: r.count + (reacted ? 1 : -1) } : r,
        )
        .filter((r) => r.count > 0);
    });
  return <EmojiReactionBar reactions={reactions} onReact={react} container={container} />;
}

export const WithPicker: Story = {
  decorators: [
    (Story) => (
      <div className="min-h-80 w-full max-w-md">
        <Story />
      </div>
    ),
  ],
  render: () => <Bar />,
};

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="min-h-80 w-[320px] max-w-full">
        <Story />
      </div>
    ),
  ],
  render: () => <Bar />,
};

/** The picker renders in a portal, so a scoped preset needs the portal inside the scoped element. */
export const BrutalPreset: Story = {
  render: function Render() {
    const [scope, setScope] = useState<HTMLElement | null>(null);
    return (
      <div ref={setScope} data-style="brutal" className="relative min-h-80 bg-surface p-card">
        <Bar container={scope} />
      </div>
    );
  },
};
