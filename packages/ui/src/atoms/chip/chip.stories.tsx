import type { Meta, StoryObj } from "@storybook/react-vite";
import { Scissors } from "lucide-react";
import { Chip, type ChipTone } from "./chip.js";

const tones: ChipTone[] = ["neutral", "danger", "warning", "success", "accent", "solid", "outline"];

const meta = {
  title: "Atoms/Chip",
  component: Chip,
  tags: ["autodocs"],
  args: { children: "Corte clásico", tone: "neutral" },
  argTypes: {
    tone: { control: "select", options: tones },
    square: { control: "boolean" },
    children: { control: "text" },
  },
} satisfies Meta<typeof Chip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Square: Story = { args: { square: true, tone: "accent", children: "Barba" } };

export const WithIcon: Story = {
  args: {
    tone: "success",
    children: (
      <>
        <Scissors aria-hidden /> Confirmada
      </>
    ),
  },
};

export const AllTones: Story = {
  render: (args) => (
    <div className="flex flex-wrap gap-2">
      {tones.map((tone) => (
        <Chip key={tone} {...args} tone={tone}>
          {tone}
        </Chip>
      ))}
    </div>
  ),
};

export const AllTonesSquare: Story = {
  render: (args) => (
    <div className="flex flex-wrap gap-2">
      {tones.map((tone) => (
        <Chip key={tone} {...args} tone={tone} square>
          {tone}
        </Chip>
      ))}
    </div>
  ),
};
