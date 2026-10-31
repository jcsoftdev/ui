import type { Meta, StoryObj } from "@storybook/react-vite";
import { Meter, Progress } from "./progress.js";

const meta = {
  title: "Atoms/Progress",
  component: Progress,
  tags: ["autodocs"],
  args: { value: 60, max: 100, "aria-label": "Meta de ingresos del día" },
  argTypes: {
    value: { control: { type: "range", min: 0, max: 100, step: 1 } },
    max: { control: "number" },
    tone: {
      control: "select",
      options: ["accent", "neutral", "success", "warning", "danger", "info"],
    },
    "aria-label": { control: "text" },
  },
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Progress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = { args: { value: 0 } };

export const Complete: Story = { args: { value: 100 } };

export const CustomMax: Story = {
  args: { value: 840, max: 1200, "aria-label": "S/ 840 de S/ 1 200" },
};

export const ThinMeter: Story = {
  render: (args) => <Meter {...args} />,
};

export const Comparison: Story = {
  render: (args) => (
    <div className="grid gap-3">
      <Progress {...args} />
      <Meter {...args} />
    </div>
  ),
};

export const Tones: Story = {
  render: (args) => (
    <div className="grid gap-3">
      {(["neutral", "success", "warning", "danger", "info"] as const).map((tone) => (
        <Progress key={tone} {...args} tone={tone} aria-label={`Progreso ${tone}`} />
      ))}
    </div>
  ),
};
