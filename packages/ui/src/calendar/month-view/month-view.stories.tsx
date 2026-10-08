import type { Meta, StoryObj } from "@storybook/react-vite";
import type { CalendarEvent, CalendarMarker } from "../internal/types.js";
import { MonthView } from "./month-view.js";

const events: CalendarEvent[] = [
  { id: "c1", date: "2026-10-02", start: "10:00", title: "Marco Salas · Corte", tone: "success" },
  { id: "c2", date: "2026-10-05", start: "11:00", title: "José Carrasco · Barba", tone: "success" },
  {
    id: "c3",
    date: "2026-10-06",
    start: "10:00",
    title: "Andrés Paredes · Perfilado",
    tone: "danger",
  },
  { id: "c4", date: "2026-10-07", start: "15:00", title: "Renzo Vega · Color", tone: "accent" },
  { id: "c5", date: "2026-10-08", start: "10:00", title: "Pedro León · Corte", tone: "success" },
  {
    id: "c6",
    date: "2026-10-08",
    start: "10:30",
    title: "Hugo Medina · Corte + cejas",
    tone: "accent",
  },
  {
    id: "c7",
    date: "2026-10-08",
    start: "11:30",
    title: "Luis Ramírez · Corte + barba",
    tone: "accent",
  },
  {
    id: "c8",
    date: "2026-10-08",
    start: "16:30",
    title: "Sergio Ortiz · Corte + barba",
    tone: "warning",
  },
  { id: "c9", date: "2026-10-09", start: "09:30", title: "Iván Cruz · Barba", tone: "accent" },
  {
    id: "c10",
    date: "2026-10-10",
    start: "11:30",
    title: "Diego Rivas · Corte + barba",
    tone: "accent",
  },
  {
    id: "c11",
    date: "2026-10-10",
    start: "12:30",
    title: "Tomás Silva · Corte niño",
    tone: "warning",
  },
  { id: "c12", date: "2026-10-14", start: "10:00", title: "Jorge Vidal · Corte", tone: "accent" },
  { id: "c13", date: "2026-10-20", start: "17:00", title: "Álvaro Peña · Barba", tone: "accent" },
  { id: "c14", date: "2026-10-27", start: "14:00", title: "Fabio Núñez · Corte", tone: "neutral" },
];

const markers: CalendarMarker[] = [
  { id: "m1", date: "2026-10-08", title: "Feriado: Angamos", tone: "danger" },
  { id: "m2", date: "2026-10-16", title: "Llega pedido de pomadas", tone: "accent" },
];

const meta = {
  title: "Calendar/MonthView",
  component: MonthView,
  tags: ["autodocs"],
  args: {
    month: "2026-10-08",
    today: "2026-10-08",
    events,
    markers,
    shadedDates: ["2026-10-04", "2026-10-11", "2026-10-18", "2026-10-25"],
    locale: "es-PE",
    weekStartsOn: 1,
    formatMore: (count: number) => `+${count} más`,
  },
  argTypes: {
    month: { control: "text" },
    today: { control: "text" },
    locale: { control: "text" },
    weekStartsOn: { control: "inline-radio", options: [0, 1, 2, 3, 4, 5, 6] },
    events: { control: "object" },
    markers: { control: "object" },
    shadedDates: { control: "object" },
    formatMore: { control: false },
    onOpenEvent: { action: "openEvent" },
    onOpenMarker: { action: "openMarker" },
    onSelectDate: { action: "selectDate" },
  },
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MonthView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SundayStart: Story = { args: { weekStartsOn: 0 } };

export const Empty: Story = { args: { events: [], markers: [], shadedDates: [] } };

export const NextMonth: Story = { args: { month: "2026-11-15", today: "2026-10-08" } };

/** 320 px container: use it to check the narrow layout without resizing the viewport. */
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="@container/page w-[320px] max-w-full">
        <Story />
      </div>
    ),
  ],
};
