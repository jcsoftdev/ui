import type { Meta, StoryObj } from "@storybook/react-vite";
import { Avatar } from "../../atoms/avatar/avatar.js";
import type { CalendarEvent, CalendarMarker } from "../internal/types.js";
import { TimelineView } from "./timeline-view.js";

const events: CalendarEvent[] = [
  {
    id: "c1",
    date: "2026-10-08",
    start: "10:00",
    end: "10:30",
    title: "Pedro León · Corte clásico",
    subtitle: "Diego Quispe · S/ 25",
    tone: "success",
    srLabel: "Atendida:",
  },
  {
    id: "c2",
    date: "2026-10-08",
    start: "11:30",
    end: "12:20",
    title: "Luis Ramírez · Corte + barba",
    subtitle: "Diego Quispe · S/ 45",
    tone: "accent",
    srLabel: "Confirmada:",
    trailing: <Avatar name="Diego Quispe" />,
  },
  {
    id: "c3",
    date: "2026-10-08",
    start: "16:30",
    end: "17:20",
    title: "Sergio Ortiz · Corte + barba",
    subtitle: "Mateo Flores · S/ 45",
    tone: "warning",
    srLabel: "Por confirmar:",
  },
  {
    id: "c4",
    date: "2026-10-09",
    start: "09:30",
    end: "10:00",
    title: "Iván Cruz · Barba",
    subtitle: "Diego Quispe · S/ 20",
    tone: "accent",
    srLabel: "Confirmada:",
  },
  {
    id: "c5",
    date: "2026-10-10",
    start: "11:30",
    end: "12:20",
    title: "Diego Rivas · Corte + barba",
    subtitle: "Mateo Flores · S/ 45",
    tone: "accent",
    srLabel: "Confirmada:",
  },
  {
    id: "c6",
    date: "2026-10-10",
    start: "10:00",
    end: "10:30",
    title: "Tomás Silva · Corte niño",
    subtitle: "Camila Rojas · S/ 20",
    tone: "danger",
    srLabel: "No asistió:",
  },
];

const markers: CalendarMarker[] = [
  {
    id: "m1",
    date: "2026-10-08",
    title: "Feriado: Angamos",
    subtitle: "Horario reducido",
    tone: "danger",
    srLabel: "Feriado:",
  },
  {
    id: "m2",
    date: "2026-10-09",
    title: "Llega pedido de pomadas",
    tone: "accent",
    srLabel: "Recordatorio:",
  },
];

const meta = {
  title: "Calendar/TimelineView",
  component: TimelineView,
  tags: ["autodocs"],
  args: {
    today: "2026-10-08",
    events,
    markers,
    hiddenDates: ["2026-10-11"],
    locale: "es-PE",
    todayLabel: "hoy",
    emptyLabel: "Sin citas",
  },
  argTypes: {
    today: { control: "text" },
    locale: { control: "text" },
    todayLabel: { control: "text" },
    emptyLabel: { control: "text" },
    events: { control: "object" },
    markers: { control: "object" },
    hiddenDates: { control: "object" },
    onOpenEvent: { action: "openEvent" },
    onOpenMarker: { action: "openMarker" },
  },
  decorators: [
    (Story) => (
      <div className="max-w-3xl rounded-lg border border-line bg-surface">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TimelineView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { parameters: { a11y: { test: "todo" } } };

export const EmptyToday: Story = { args: { events: [], markers: [] } };

export const HiddenDates: Story = {
  parameters: { a11y: { test: "todo" } },
  args: { hiddenDates: ["2026-10-09", "2026-10-10"] },
};

export const MarkersOnly: Story = { parameters: { a11y: { test: "todo" } }, args: { events: [] } };

/** 320 px container: use it to check the narrow layout without resizing the viewport. */
export const Narrow: Story = {
  parameters: { a11y: { test: "todo" } },
  decorators: [
    (Story) => (
      <div className="@container/page w-[320px] max-w-full">
        <Story />
      </div>
    ),
  ],
};
