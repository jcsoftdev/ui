import type { Meta, StoryObj } from "@storybook/react-vite";
import { UNIT_ICONS } from "../core/unit-icons.js";
import { IsotypeRows } from "./isotype-rows.js";

const servicesByBarber = [
  { id: "kevin", name: "Kevin", value: 42 },
  { id: "renzo", name: "Renzo", value: 38 },
  { id: "abel", name: "Abel", value: 51 },
  { id: "diego", name: "Diego", value: 29 },
  { id: "luis", name: "Luis", value: 35 },
];

const spanishLabels = {
  empty: "Sin datos para mostrar",
  loading: "Cargando gráfico",
  resetZoom: "Ver todo",
  total: "Total",
  explore: "Categorías del gráfico. Usa las flechas para recorrerlas.",
  brush: "Rango visible",
  category: "Barbero",
};

const meta = {
  title: "Charts/IsotypeRows",
  component: IsotypeRows,
  tags: ["autodocs"],
  args: {
    title: "Servicios por barbero esta semana",
    data: servicesByBarber,
    perIcon: 5,
    icon: "scissors",
    colorMode: "single",
    track: false,
    rowHeight: 34,
    gap: 0.18,
    valueFormat: "integer",
    showValues: true,
    unitLabel: "servicios",
    tooltip: true,
    animate: true,
    loading: false,
    labels: spanishLabels,
  },
  argTypes: {
    icon: {
      control: "select",
      options: Object.keys(UNIT_ICONS),
    },
    colorMode: { control: "inline-radio", options: ["single", "category"] },
    perIcon: { control: { type: "number", min: 1, step: 1 } },
    rowHeight: { control: { type: "range", min: 20, max: 60, step: 2 } },
    gap: { control: { type: "range", min: 0, max: 0.6, step: 0.02 } },
    data: { control: false },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 760, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof IsotypeRows>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ColorPerRow: Story = { args: { colorMode: "category" } };

export const WithTrack: Story = { name: "Track to the longest row", args: { track: true } };

export const IconPerRow: Story = {
  name: "Icon per row",
  args: {
    title: "Ventas del día (1 ícono = 2)",
    data: [
      { id: "cortes", name: "Cortes", value: 23, icon: "scissors" },
      { id: "afeitados", name: "Afeitados", value: 12, icon: "person" },
      { id: "shampoo", name: "Shampoo", value: 7, icon: "bottle" },
      { id: "citas", name: "Citas web", value: 15, icon: "calendar" },
    ],
    perIcon: 2,
    colorMode: "category",
    unitLabel: "ventas",
    labels: { ...spanishLabels, category: "Tipo" },
  },
};

/** Average rating per barber: full stars plus a cut one for the decimals (4.6 = four and 60% of a fifth). */
export const ReviewRatings: Story = {
  args: {
    title: "Calificación promedio por barbero",
    data: [
      { id: "abel", name: "Abel", value: 4.9 },
      { id: "kevin", name: "Kevin", value: 4.7 },
      { id: "renzo", name: "Renzo", value: 4.4 },
      { id: "luis", name: "Luis", value: 4.1 },
      { id: "diego", name: "Diego", value: 3.6 },
    ],
    icon: "star",
    perIcon: 1,
    track: true,
    rowHeight: 38,
    valueFormat: "number",
    unitLabel: "estrellas",
    showKey: false,
    labels: { ...spanishLabels, category: "Barbero" },
  },
};

/** Minutes until the first reply, a clock per 5 minutes. */
export const ResponseTimes: Story = {
  args: {
    title: "Tiempo de respuesta por canal (1 reloj = 5 min)",
    data: [
      { id: "whatsapp", name: "WhatsApp", value: 7 },
      { id: "instagram", name: "Instagram", value: 18 },
      { id: "llamada", name: "Llamada", value: 3 },
      { id: "web", name: "Formulario web", value: 32 },
    ],
    icon: "clock",
    perIcon: 5,
    colorMode: "category",
    rowHeight: 36,
    unitLabel: "min",
    labels: { ...spanishLabels, category: "Canal" },
  },
};

/** Clients registered per sede, a pin per 20 clients. */
export const StoreLocations: Story = {
  args: {
    title: "Clientes registrados por sede (1 pin = 20)",
    data: [
      { id: "miraflores", name: "Miraflores", value: 210 },
      { id: "san-isidro", name: "San Isidro", value: 164 },
      { id: "surco", name: "Surco", value: 118 },
      { id: "barranco", name: "Barranco", value: 87 },
    ],
    icon: "pin",
    perIcon: 20,
    colorMode: "category",
    rowHeight: 38,
    unitLabel: "clientes",
    labels: { ...spanishLabels, category: "Sede" },
  },
};

export const Loading: Story = { args: { loading: true } };

export const Empty: Story = { args: { data: [] } };

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 320, maxWidth: "100%" }}>
        <Story />
      </div>
    ),
  ],
};
