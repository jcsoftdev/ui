import type { Meta, StoryObj } from "@storybook/react-vite";
import { PressableFeedback } from "./pressable-feedback.js";

const meta = {
  title: "Atoms/PressableFeedback",
  component: PressableFeedback,
  tags: ["autodocs"],
  args: { ripple: true, scale: true },
  argTypes: {
    ripple: { control: "boolean" },
    scale: { control: "boolean" },
    disabled: { control: "boolean" },
    children: { control: false },
  },
  render: (args) => (
    <PressableFeedback {...args} className="rounded-card">
      <button
        type="button"
        className="rounded-card border-card bg-surface-card px-card py-3 text-control text-ink shadow-card focus-visible:focus-ring"
      >
        Reservar corte · S/ 35
      </button>
    </PressableFeedback>
  ),
} satisfies Meta<typeof PressableFeedback>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const RippleOnly: Story = { args: { scale: false } };

export const Disabled: Story = { args: { disabled: true } };

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="w-[320px] max-w-full">
        <Story />
      </div>
    ),
  ],
};

export const BrutalPreset: Story = {
  decorators: [
    (Story) => (
      <div data-style="brutal" className="bg-surface p-card">
        <Story />
      </div>
    ),
  ],
};
