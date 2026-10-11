import type { Meta, StoryObj } from "@storybook/react-vite";
import { ToolCall } from "./tool-call.js";

const meta = {
  title: "AI/ToolCall",
  component: ToolCall,
  tags: ["autodocs"],
  args: {
    name: "buscar_turnos",
    status: "done",
    duration: "1,2 s",
    defaultOpen: true,
    args: { fecha: "2026-06-20", barbero: "Diego Quispe" },
    result: { libres: ["10:00", "11:30", "16:00"], total: 3 },
  },
  argTypes: {
    name: { control: "text" },
    status: { control: "inline-radio", options: ["pending", "running", "done", "error"] },
    duration: { control: "text" },
    error: { control: "text" },
    defaultOpen: { control: "boolean" },
    args: { control: "object" },
    result: { control: "object" },
  },
  decorators: [
    (Story) => (
      <div className="max-w-xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ToolCall>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Running: Story = {
  args: { status: "running", result: undefined, duration: undefined, defaultOpen: false },
};

export const Failed: Story = {
  args: {
    status: "error",
    error: "No se pudo conectar con la agenda. Inténtalo de nuevo.",
    result: undefined,
  },
};

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="w-[320px]">
        <Story />
      </div>
    ),
  ],
};

export const PresetBrutal: Story = {
  decorators: [
    (Story) => (
      <div data-style="brutal" className="bg-bg p-card">
        <Story />
      </div>
    ),
  ],
};
