import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Note } from "./note.js";

const meta = {
  title: "Containers/Note",
  component: Note,
  tags: ["autodocs"],
  args: { children: "Grades are published when the term closes." },
  argTypes: {
    tone: { control: "inline-radio", options: ["neutral", "info", "success", "warning", "danger"] },
  },
} satisfies Meta<typeof Note>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const note = within(canvasElement).getByText(/Grades are published/);
    await expect(note.tagName).toBe("P");
    await expect(getComputedStyle(note).paddingInlineStart).toBe("0px");
    await expect(getComputedStyle(note).borderTopWidth).toBe("0px");
  },
};

export const Tones: Story = {
  render: (args) => (
    <div className="flex flex-col gap-2">
      {(["neutral", "info", "success", "warning", "danger"] as const).map((tone) => (
        <Note key={tone} {...args} tone={tone}>
          {tone} note
        </Note>
      ))}
    </div>
  ),
};

export const WithDivider: Story = {
  args: { divider: true },
  play: async ({ canvasElement }) => {
    const note = within(canvasElement).getByText(/Grades are published/);
    await expect(Number.parseFloat(getComputedStyle(note).borderTopWidth)).toBeGreaterThan(0);
  },
};
