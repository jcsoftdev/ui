import type { Meta, StoryObj } from "@storybook/react-vite";
import { Kbd } from "./kbd.js";

const meta = {
  title: "Atoms/Kbd",
  component: Kbd,
  tags: ["autodocs"],
  args: { children: "⌘K" },
  argTypes: { children: { control: "text" } },
} satisfies Meta<typeof Kbd>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Combination: Story = {
  render: () => (
    <span className="inline-flex items-center gap-1 text-body text-ink-2">
      <Kbd>Ctrl</Kbd>+<Kbd>Shift</Kbd>+<Kbd>P</Kbd>
    </span>
  ),
};

export const InSentence: Story = {
  render: () => (
    <p className="text-body text-ink">
      Press <Kbd>Esc</Kbd> to close.
    </p>
  ),
};
