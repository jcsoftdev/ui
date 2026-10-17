import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Check } from "../../icons/index.js";
import { Seal } from "./seal.js";

const meta = {
  title: "Atoms/Seal",
  component: Seal,
  tags: ["autodocs"],
  args: {
    title: "Payment receipt",
    children: (
      <>
        <p>Sunrise Academy</p>
        <p>Code: 8H2K-44QF</p>
        <p>March 4, 2026</p>
      </>
    ),
  },
  argTypes: {
    tone: {
      control: "inline-radio",
      options: ["accent", "success", "warning", "danger", "neutral"],
    },
    children: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="max-w-xs">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Seal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Payment receipt")).toBeInTheDocument();
    await expect(canvas.getByText("Code: 8H2K-44QF")).toBeInTheDocument();
    await expect(canvas.queryByRole("group")).toBeNull();
    const root = canvasElement.querySelector("[data-tone]") as HTMLElement;
    await expect(Number.parseFloat(getComputedStyle(root).borderTopWidth)).toBe(2);
  },
};

export const Labelled: Story = {
  args: { label: "Verified receipt", tone: "success", icon: <Check /> },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("group", { name: "Verified receipt" }),
    ).toBeVisible();
  },
};

export const Tones: Story = {
  render: (args) => (
    <div className="flex flex-col gap-3">
      {(["accent", "success", "warning", "danger", "neutral"] as const).map((tone) => (
        <Seal key={tone} {...args} tone={tone} title={tone} />
      ))}
    </div>
  ),
};
