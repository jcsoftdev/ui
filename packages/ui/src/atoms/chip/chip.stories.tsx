import type { Meta, StoryObj } from "@storybook/react-vite";
import { Scissors } from "../../icons/index.js";
import { Chip, type ChipTone } from "./chip.js";

const tones: ChipTone[] = [
  "neutral",
  "danger",
  "warning",
  "success",
  "info",
  "accent",
  "solid",
  "outline",
];

const meta = {
  title: "Atoms/Chip",
  component: Chip,
  tags: ["autodocs"],
  args: { children: "Corte clásico", tone: "neutral" },
  argTypes: {
    tone: { control: "select", options: tones },
    square: { control: "boolean" },
    statusIcon: { control: "boolean" },
    icon: { control: false },
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

export const StatusIcon: Story = {
  render: (args) => (
    <div className="flex flex-wrap gap-2">
      {(["info", "success", "warning", "danger"] as const).map((tone) => (
        <Chip key={tone} {...args} tone={tone} statusIcon>
          {tone}
        </Chip>
      ))}
    </div>
  ),
};

export const Removable: Story = {
  args: { tone: "accent", children: "Barba", onRemove: () => {} },
};

export const IconProp: Story = {
  args: { tone: "accent", icon: <Scissors aria-hidden />, children: "Corte clásico" },
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

/** `tone` also takes the name of a tone declared in `tonePalettes`; the variables are set inline here. */
export const CustomTone: Story = {
  args: { tone: "mint", children: "Yape" },
  decorators: [
    (Story) => (
      <div
        style={
          {
            "--tone-mint": "oklch(0.62 0.14 165)",
            "--tone-mint-soft": "oklch(0.95 0.04 165)",
            "--tone-mint-ink": "oklch(0.42 0.1 165)",
          } as React.CSSProperties
        }
      >
        <Story />
      </div>
    ),
  ],
};
