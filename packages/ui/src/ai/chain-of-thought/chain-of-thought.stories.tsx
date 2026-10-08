import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChainOfThought } from "./chain-of-thought.js";

const meta = {
  title: "AI/ChainOfThought",
  component: ChainOfThought,
  tags: ["autodocs"],
  args: {
    title: "Razonamiento",
    duration: "4 s",
    defaultOpen: true,
    steps: [
      {
        id: "1",
        label: "Entender el pedido",
        detail: "El cliente quiere un turno el sábado por la mañana.",
        status: "done",
      },
      {
        id: "2",
        label: "Consultar la agenda de Diego",
        detail: "Tres huecos libres entre 10:00 y 12:00.",
        status: "done",
      },
      { id: "3", label: "Proponer el horario más cercano", status: "done" },
    ],
  },
  argTypes: {
    title: { control: "text" },
    duration: { control: "text" },
    defaultOpen: { control: "boolean" },
    steps: { control: "object" },
    open: { control: false },
    onOpenChange: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="max-w-xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ChainOfThought>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Thinking: Story = {
  args: {
    duration: undefined,
    steps: [
      { id: "1", label: "Entender el pedido", status: "done" },
      {
        id: "2",
        label: "Consultar la agenda de Diego",
        detail: "Buscando huecos libres…",
        status: "active",
      },
      { id: "3", label: "Proponer el horario más cercano", status: "pending" },
    ],
  },
};

export const Collapsed: Story = { args: { defaultOpen: false } };

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
