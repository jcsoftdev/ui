import type { Meta, StoryObj } from "@storybook/react-vite";
import { Loader } from "./loader.js";

const meta = {
  title: "AI/Loader",
  component: Loader,
  tags: ["autodocs"],
  args: { variant: "dots", size: "md", label: "Escribiendo…" },
  argTypes: {
    variant: { control: "inline-radio", options: ["dots", "typing"] },
    size: { control: "inline-radio", options: ["sm", "md"] },
    label: { control: "text" },
  },
} satisfies Meta<typeof Loader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Typing: Story = {
  args: { variant: "typing", label: "El asistente está escribiendo…" },
};

export const Narrow: Story = {
  args: { variant: "typing", label: "El asistente está escribiendo una respuesta larga" },
  decorators: [
    (Story) => (
      <div className="w-[320px]">
        <Story />
      </div>
    ),
  ],
};

export const PresetBrutal: Story = {
  args: { variant: "typing" },
  decorators: [
    (Story) => (
      <div data-style="brutal" className="bg-bg p-card">
        <Story />
      </div>
    ),
  ],
};
