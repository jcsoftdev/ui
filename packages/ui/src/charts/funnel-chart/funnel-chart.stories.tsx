import type { Meta, StoryObj } from "@storybook/react-vite";
import { FunnelChart } from "./funnel-chart.js";

const bookings = [
  { id: "visitas", name: "Visitas", value: 4200 },
  { id: "reservas", name: "Reservas", value: 1260 },
  { id: "confirmadas", name: "Confirmadas", value: 980 },
  { id: "atendidas", name: "Atendidas", value: 870 },
];

const spanishLabels = {
  empty: "Sin datos para este periodo",
  loading: "Cargando gráfico",
  explore: "Etapas del embudo. Usa las flechas para recorrerlas.",
  category: "Etapa",
  value: "Cantidad",
  share: "Del total",
  conversion: "Conversión",
};

const meta = {
  title: "Charts/FunnelChart",
  component: FunnelChart,
  tags: ["autodocs"],
  args: {
    title: "Embudo de reservas del mes",
    stages: bookings,
    variant: "funnel",
    orientation: "vertical",
    showConversion: true,
    tone: "categorical",
    gap: 4,
    valueFormat: "integer",
    tooltip: true,
    loading: false,
    animate: true,
    labels: spanishLabels,
  },
  argTypes: {
    variant: { control: "inline-radio", options: ["funnel", "pyramid"] },
    orientation: { control: "inline-radio", options: ["vertical", "horizontal"] },
    tone: { control: "inline-radio", options: ["categorical", "accent"] },
    gap: { control: { type: "range", min: 0, max: 16, step: 1 } },
    height: { control: { type: "range", min: 200, max: 560, step: 10 } },
    stages: { control: false },
    labels: { control: false },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 720, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FunnelChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Horizontal: Story = { args: { orientation: "horizontal" } };

export const AccentRamp: Story = { args: { tone: "accent" } };

export const Pyramid: Story = {
  args: {
    title: "Fidelidad de clientes",
    variant: "pyramid",
    tone: "accent",
    stages: [
      { id: "ocasionales", name: "Ocasionales", value: 640 },
      { id: "regulares", name: "Regulares", value: 380 },
      { id: "frecuentes", name: "Frecuentes", value: 170 },
      { id: "vip", name: "VIP", value: 48 },
    ],
  },
};

export const HorizontalPyramid: Story = {
  args: { ...Pyramid.args, orientation: "horizontal" },
};

export const WithoutConversion: Story = { args: { showConversion: false } };

export const Loading: Story = { args: { loading: true } };

export const Empty: Story = { args: { stages: [] } };

/** 320 px container: the label column shrinks and names truncate; the tooltip has the detail. */
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 320, maxWidth: "100%" }}>
        <Story />
      </div>
    ),
  ],
};

export const NarrowHorizontal: Story = {
  args: { orientation: "horizontal" },
  decorators: Narrow.decorators,
};
