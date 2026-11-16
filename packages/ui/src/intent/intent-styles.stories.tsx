import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Card } from "../containers/card/card.js";
import { Input } from "../forms/input/input.js";

const meta = {
  title: "Intent/Highlight",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const HighlightAndChanged: Story = {
  render: () => (
    <div className="flex max-w-md flex-col gap-6 p-4">
      <Card data-intent-highlight="" data-testid="highlighted">
        Revealed by the assistant
      </Card>
      <Input aria-label="Guests" defaultValue="4" data-intent-changed="" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const card = canvas.getByTestId("highlighted");
    const input = canvas.getByRole("textbox", { name: "Guests" });
    await expect(getComputedStyle(card).outlineStyle).toBe("solid");
    await expect(getComputedStyle(input).outlineStyle).toBe("dashed");
  },
};
