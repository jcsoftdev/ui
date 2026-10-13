import type { Meta, StoryObj } from "@storybook/react-vite";
import { LiveStatusBar } from "./live-status-bar.js";

const meta = {
  title: "States/LiveStatusBar",
  component: LiveStatusBar,
  tags: ["autodocs"],
  args: {
    status: "live",
    children: <span className="text-ink-2">3 orders waiting</span>,
  },
  argTypes: {
    status: { control: "inline-radio", options: ["live", "reconnecting", "offline"] },
    children: { control: false },
    labels: { control: "object" },
  },
} satisfies Meta<typeof LiveStatusBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Live: Story = {};

export const Reconnecting: Story = { args: { status: "reconnecting" } };

export const Offline: Story = { args: { status: "offline" } };
