import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../../atoms/button/button.js";
import { OfflineBanner } from "./offline-banner.js";

const meta = {
  title: "States/OfflineBanner",
  component: OfflineBanner,
  tags: ["autodocs"],
  args: {
    message: "Sin conexión. Los cobros se guardarán y se enviarán al reconectar.",
    queuedChanges: 0,
    queuedLabel: "cambios pendientes",
  },
  argTypes: {
    message: { control: "text" },
    queuedChanges: { control: "number" },
    queuedLabel: { control: "text" },
  },
} satisfies Meta<typeof OfflineBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithQueuedChanges: Story = { args: { queuedChanges: 3 } };

export const WithAction: Story = {
  args: { action: <Button variant="secondary">Retry</Button> },
};
