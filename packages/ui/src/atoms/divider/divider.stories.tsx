import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Divider } from "./divider.js";

const meta = {
  title: "Atoms/Divider",
  component: Divider,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Divider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Plain: Story = {};

export const Labelled: Story = {
  args: { children: "con tu cuenta" },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("separator", { name: "con tu cuenta" }),
    ).toBeVisible();
  },
};
