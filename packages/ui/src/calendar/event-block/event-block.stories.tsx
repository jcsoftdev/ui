import type { Meta, StoryObj } from "@storybook/react-vite";
import { Avatar } from "../../atoms/avatar/avatar.js";
import type { CalendarEvent } from "../internal/types.js";
import { EventBlock } from "./event-block.js";

const cita: CalendarEvent = {
  id: "cita-1",
  date: "2026-10-08",
  start: "11:30",
  end: "12:20",
  title: "Luis Ramírez · Corte + barba",
  subtitle: "Diego Quispe · S/ 45",
  tone: "accent",
  srLabel: "Confirmada:",
};

const meta = {
  title: "Calendar/EventBlock",
  component: EventBlock,
  tags: ["autodocs"],
  args: { event: cita, variant: "detailed" },
  argTypes: {
    variant: { control: "inline-radio", options: ["detailed", "compact"] },
    event: { control: "object" },
    onOpen: { action: "open" },
    className: { control: "text" },
  },
  decorators: [
    (Story) => (
      <div className="max-w-lg">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EventBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Compact: Story = { args: { variant: "compact" } };

export const WithTrailingAvatar: Story = {
  args: { event: { ...cita, trailing: <Avatar name="Diego Quispe" /> } },
};

export const NoEndTime: Story = {
  args: { event: { ...cita, end: undefined, title: "Marco Salas · Perfilado de barba" } },
};

export const Tones: Story = {
  render: (args) => (
    <div className="flex flex-col gap-2">
      <EventBlock
        {...args}
        event={{ ...cita, tone: "success", subtitle: "Atendida · S/ 45", srLabel: "Atendida:" }}
      />
      <EventBlock
        {...args}
        event={{ ...cita, tone: "warning", subtitle: "Por confirmar", srLabel: "Pendiente:" }}
      />
      <EventBlock
        {...args}
        event={{ ...cita, tone: "danger", subtitle: "No asistió", srLabel: "Ausente:" }}
      />
      <EventBlock
        {...args}
        event={{ ...cita, tone: "neutral", subtitle: "Almuerzo del equipo", title: "Bloqueado" }}
      />
    </div>
  ),
};

export const CompactTones: Story = {
  args: { variant: "compact" },
  render: (args) => (
    <div className="flex max-w-xs flex-col gap-1">
      {(["accent", "success", "warning", "danger", "neutral"] as const).map((tone) => (
        <EventBlock key={tone} {...args} event={{ ...cita, tone, id: tone }} />
      ))}
    </div>
  ),
};
