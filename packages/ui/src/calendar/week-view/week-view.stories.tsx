import type { Meta, StoryObj } from "@storybook/react-vite";
import { Avatar } from "../../atoms/avatar/avatar.js";
import type { CalendarEvent, CalendarMarker } from "../internal/types.js";
import { WeekView } from "./week-view.js";

const events: CalendarEvent[] = [
  {
    id: "c1",
    date: "2026-10-05",
    start: "10:00",
    end: "10:30",
    title: "José Carrasco · Corte clásico",
    subtitle: "Diego Quispe · S/ 25",
    tone: "success",
    srLabel: "Atendida:",
  },
  {
    id: "c2",
    date: "2026-10-05",
    start: "11:00",
    end: "11:50",
    title: "Marco Salas · Corte + barba",
    subtitle: "Mateo Flores · S/ 45",
    tone: "success",
    srLabel: "Atendida:",
  },
  {
    id: "c3",
    date: "2026-10-06",
    start: "10:00",
    end: "10:30",
    title: "Andrés Paredes · Perfilado",
    subtitle: "Camila Rojas · S/ 20",
    tone: "danger",
    srLabel: "No asistió:",
  },
  {
    id: "c4",
    date: "2026-10-07",
    start: "15:00",
    end: "16:00",
    title: "Renzo Vega · Color + corte",
    subtitle: "Camila Rojas · S/ 90",
    tone: "accent",
    srLabel: "Confirmada:",
  },
  {
    id: "c5",
    date: "2026-10-08",
    start: "10:00",
    end: "10:30",
    title: "Pedro León · Corte clásico",
    subtitle: "Diego Quispe · S/ 25",
    tone: "success",
    srLabel: "Atendida:",
  },
  {
    id: "c6",
    date: "2026-10-08",
    start: "10:00",
    end: "11:00",
    title: "Hugo Medina · Corte + cejas",
    subtitle: "Mateo Flores · S/ 35",
    tone: "accent",
    srLabel: "Confirmada:",
  },
  {
    id: "c7",
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
    id: "c8",
    date: "2026-10-08",
    start: "13:00",
    end: "14:00",
    title: "Almuerzo del equipo",
    tone: "neutral",
    srLabel: "Bloqueado:",
  },
  {
    id: "c9",
    date: "2026-10-08",
    start: "16:30",
    end: "17:20",
    title: "Sergio Ortiz · Corte + barba",
    subtitle: "Mateo Flores · S/ 45",
    tone: "warning",
    srLabel: "Por confirmar:",
  },
  {
    id: "c10",
    date: "2026-10-09",
    start: "09:30",
    end: "10:00",
    title: "Iván Cruz · Barba",
    subtitle: "Diego Quispe · S/ 20",
    tone: "accent",
    srLabel: "Confirmada:",
  },
  {
    id: "c11",
    date: "2026-10-09",
    start: "12:00",
    title: "Tomás Silva · Corte niño",
    subtitle: "Camila Rojas · S/ 20",
    tone: "warning",
    srLabel: "Por confirmar:",
  },
  {
    id: "c12",
    date: "2026-10-10",
    start: "11:30",
    end: "12:20",
    title: "Diego Rivas · Corte + barba",
    subtitle: "Mateo Flores · S/ 45",
    tone: "accent",
    srLabel: "Confirmada:",
  },
  {
    id: "c13",
    date: "2026-10-10",
    start: "00:00",
    title: "Curso de degradados",
    tone: "neutral",
    allDay: true,
    srLabel: "Capacitación:",
  },
];

const markers: CalendarMarker[] = [
  { id: "m1", date: "2026-10-08", title: "Feriado: Angamos", tone: "danger", srLabel: "Feriado:" },
  {
    id: "m2",
    date: "2026-10-09",
    title: "Llega pedido de pomadas",
    tone: "accent",
    srLabel: "Recordatorio:",
  },
];

const meta = {
  title: "Calendar/WeekView",
  component: WeekView,
  tags: ["autodocs"],
  args: {
    week: "2026-10-08",
    today: "2026-10-08",
    currentTime: "11:45",
    events,
    markers,
    shadedDates: ["2026-10-11"],
    workingHours: [10, 19],
    locale: "es-PE",
    weekStartsOn: 1,
    allDayLabel: "Todo el día",
  },
  argTypes: {
    week: { control: "text" },
    today: { control: "text" },
    currentTime: { control: "text" },
    locale: { control: "text" },
    weekStartsOn: { control: "inline-radio", options: [0, 1, 2, 3, 4, 5, 6] },
    allDayLabel: { control: "text" },
    events: { control: "object" },
    markers: { control: "object" },
    shadedDates: { control: "object" },
    workingHours: { control: "object" },
    onOpenEvent: { action: "openEvent" },
    onOpenMarker: { action: "openMarker" },
  },
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WeekView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SundayStart: Story = { args: { weekStartsOn: 0, locale: "es-PE" } };

export const Empty: Story = {
  args: {
    events: [],
    markers: [],
    currentTime: undefined,
    shadedDates: [],
    workingHours: undefined,
  },
};

export const NoNowLine: Story = { args: { currentTime: undefined } };

export const BusyDay: Story = {
  args: {
    events: [
      {
        id: "b1",
        date: "2026-10-08",
        start: "10:00",
        end: "11:00",
        title: "Cita 1 · Corte",
        subtitle: "Diego Quispe",
        tone: "accent",
      },
      {
        id: "b2",
        date: "2026-10-08",
        start: "10:15",
        end: "11:15",
        title: "Cita 2 · Corte + barba",
        subtitle: "Mateo Flores",
        tone: "success",
      },
      {
        id: "b3",
        date: "2026-10-08",
        start: "10:30",
        end: "11:30",
        title: "Cita 3 · Color",
        subtitle: "Camila Rojas",
        tone: "warning",
      },
    ],
    markers: [],
  },
};
