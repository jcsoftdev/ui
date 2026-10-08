import type { Meta, StoryObj } from "@storybook/react-vite";
import { ParliamentChart } from "./parliament-chart.js";

const pollVotes = [
  { id: "clasico", name: "Corte clásico", value: 48 },
  { id: "degradado", name: "Degradado", value: 39 },
  { id: "barba", name: "Corte + barba", value: 27 },
  { id: "tinte", name: "Tinte", value: 9 },
  { id: "otros", name: "Otros", value: 7 },
];

const spanishLabels = {
  empty: "Sin datos para mostrar",
  loading: "Cargando gráfico",
  resetZoom: "Ver todo",
  total: "Total",
  explore: "Categorías del gráfico. Usa las flechas para recorrerlas.",
  brush: "Rango visible",
  category: "Servicio",
};

const meta = {
  title: "Charts/ParliamentChart",
  component: ParliamentChart,
  tags: ["autodocs"],
  args: {
    title: "Encuesta: servicio favorito (130 clientes)",
    data: pollVotes,
    innerRatio: 0.4,
    seatShape: "circle",
    majority: false,
    majorityLabel: "Mayoría",
    centerLabel: "votos",
    seatLabel: "Votos",
    height: 260,
    legend: true,
    tooltip: true,
    animate: true,
    loading: false,
    labels: spanishLabels,
  },
  argTypes: {
    seatShape: { control: "inline-radio", options: ["circle", "square"] },
    legend: { control: "select", options: [true, false, "top", "bottom"] },
    majority: { control: "boolean" },
    rows: { control: { type: "number", min: 1, max: 20, step: 1 } },
    innerRatio: { control: { type: "range", min: 0, max: 0.8, step: 0.05 } },
    height: { control: { type: "range", min: 140, max: 420, step: 10 } },
    data: { control: false },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 760, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ParliamentChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithMajority: Story = {
  name: "Majority line",
  args: {
    title: "Votación del equipo: horario de domingo",
    data: [
      { id: "si", name: "A favor", value: 14, color: "var(--success)" },
      { id: "no", name: "En contra", value: 9, color: "var(--danger)" },
      { id: "abs", name: "Abstención", value: 3, color: "var(--ink-3)" },
    ],
    majority: true,
    centerLabel: "barberos",
    seatLabel: "Votos",
    labels: { ...spanishLabels, category: "Opción" },
  },
};

export const SquareSeats: Story = { args: { seatShape: "square" } };

export const ManySeats: Story = {
  name: "Many seats (auto rows)",
  args: {
    title: "Reservas del mes por canal",
    data: [
      { id: "app", name: "App", value: 214 },
      { id: "whatsapp", name: "WhatsApp", value: 133 },
      { id: "telefono", name: "Teléfono", value: 58 },
      { id: "presencial", name: "Presencial", value: 41 },
    ],
    centerLabel: "reservas",
    seatLabel: "Reservas",
    height: 300,
    labels: { ...spanishLabels, category: "Canal" },
  },
};

export const FixedRows: Story = { args: { rows: 3, innerRatio: 0.55 } };

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
  args: { majority: true, height: 200 },
};
