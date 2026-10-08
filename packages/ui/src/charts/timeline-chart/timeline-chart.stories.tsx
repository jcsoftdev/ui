import type { Meta, StoryObj } from "@storybook/react-vite";
import { TimelineChart, type TimelineItem } from "./timeline-chart.js";

const at = (h: number, m = 0) => new Date(2026, 9, 8, h, m);

const rows = [
  { id: "mateo", label: "Mateo" },
  { id: "valeria", label: "Valeria" },
  { id: "diego", label: "Diego" },
  { id: "camila", label: "Camila" },
];

const groups = [
  { id: "completada", name: "Completada", color: "var(--chart-up)" },
  { id: "en-curso", name: "En curso", color: "var(--accent-word)" },
  { id: "confirmada", name: "Confirmada", color: "var(--chart-cat-1)" },
  { id: "pendiente", name: "Pendiente", color: "var(--chart-cat-3)" },
  { id: "cancelada", name: "Cancelada", color: "var(--chart-down)" },
];

const appointment = (
  id: string,
  rowId: string,
  from: [number, number],
  to: [number, number],
  label: string,
  group: string,
  detail: string,
): TimelineItem => ({ id, rowId, start: at(...from), end: at(...to), label, group, detail });

const citas: TimelineItem[] = [
  appointment("c1", "mateo", [9, 0], [9, 45], "Luis Paredes", "completada", "Degradado"),
  appointment("c2", "mateo", [10, 0], [10, 30], "Andrés Rojas", "completada", "Barba"),
  appointment("c3", "mateo", [11, 0], [12, 0], "Jorge Salas", "en-curso", "Corte + barba"),
  appointment("c4", "mateo", [11, 30], [12, 15], "Pedro Díaz", "confirmada", "Corte clásico"),
  appointment("c5", "mateo", [14, 0], [14, 45], "Iván Cano", "pendiente", "Degradado"),
  appointment("c6", "valeria", [9, 30], [10, 30], "Marco Ruiz", "completada", "Tinte"),
  appointment("c7", "valeria", [11, 0], [11, 40], "Sergio León", "en-curso", "Corte clásico"),
  appointment("c8", "valeria", [13, 0], [13, 30], "Tomás Vega", "cancelada", "Barba"),
  appointment("c9", "valeria", [15, 0], [16, 0], "Raúl Mena", "confirmada", "Corte + barba"),
  appointment("c10", "diego", [9, 0], [9, 30], "Óscar Peña", "completada", "Corte infantil"),
  appointment("c11", "diego", [9, 15], [10, 0], "Bruno Torres", "completada", "Degradado"),
  appointment("c12", "diego", [10, 30], [11, 15], "Hugo Prado", "completada", "Corte clásico"),
  appointment("c13", "diego", [12, 0], [12, 30], "Dani Quispe", "confirmada", "Barba"),
  appointment("c14", "diego", [16, 0], [17, 0], "Felipe Arce", "pendiente", "Limpieza facial"),
  appointment("c15", "camila", [10, 0], [10, 45], "Rafael Soto", "completada", "Degradado"),
  appointment("c16", "camila", [12, 30], [13, 15], "Gonzalo Ibarra", "confirmada", "Corte clásico"),
  appointment("c17", "camila", [17, 0], [17, 30], "Ismael Rivas", "pendiente", "Barba"),
];

const spanishLabels = {
  empty: "Sin citas para este periodo",
  loading: "Cargando agenda",
  resetZoom: "Ver todo",
  total: "Total",
  explore:
    "Citas. Flechas izquierda y derecha para recorrer, arriba y abajo para cambiar de barbero.",
  brush: "Rango visible",
  category: "Cita",
};

const spanishTexts = {
  group: "Estado",
  row: "Barbero",
  time: "Horario",
  duration: "Duración",
  now: "Ahora",
  minutes: "min",
  hours: "h",
};

const meta = {
  title: "Charts/TimelineChart",
  component: TimelineChart,
  tags: ["autodocs"],
  args: {
    title: "Agenda de hoy por barbero",
    rows,
    items: citas,
    groups,
    now: at(11, 20),
    laneHeight: 28,
    grid: true,
    tooltip: true,
    loading: false,
    animate: true,
    texts: spanishTexts,
    labels: spanishLabels,
  },
  argTypes: {
    now: { control: false },
    rows: { control: false },
    items: { control: false },
    groups: { control: false },
    domain: { control: false },
    laneHeight: { control: { type: "range", min: 18, max: 44, step: 2 } },
    legend: { control: "boolean" },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 900, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TimelineChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutNowMarker: Story = { args: { now: false, grid: false } };

export const FixedBusinessHours: Story = {
  args: { domain: [at(8), at(19)], title: "Agenda de 8:00 a 19:00" },
};

export const Compact: Story = { args: { laneHeight: 20 } };

export const LiveNow: Story = {
  name: "Now = current time",
  args: { now: "auto", domain: [at(8), at(19)] },
};

export const Loading: Story = { args: { loading: true } };

export const Empty: Story = { args: { items: [] } };

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};
