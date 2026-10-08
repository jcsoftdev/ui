import type { Meta, StoryObj } from "@storybook/react-vite";
import { type Candle, CandlestickChart } from "./candlestick-chart.js";

/** Deterministic pseudo-random sequence so the story never changes between renders. */
function sequence(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function series(
  count: number,
  start: number,
  step: (day: number) => Date,
  scale: number,
  seed: number,
): Candle[] {
  const random = sequence(seed);
  let price = start;
  return Array.from({ length: count }, (_, i) => {
    const open = price;
    const close = Math.max(scale, open + (random() - 0.46) * scale * 2.4);
    const high = Math.max(open, close) + random() * scale * 0.9;
    const low = Math.max(scale * 0.5, Math.min(open, close) - random() * scale * 0.9);
    price = close;
    return {
      date: step(i),
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume: Math.round(40 + random() * 160),
    };
  });
}

/** Weekly price of a box of pomade, S/ per unit. */
const insumo = series(52, 42, (i) => new Date(2026, 0, 5 + i * 7), 1.6, 7);
/** Daily till: opening, high, low and close of the cash balance. */
const caja = series(40, 800, (i) => new Date(2026, 8, 1 + i), 140, 21).map((c) => ({
  ...c,
  volume: undefined,
}));

const spanishLabels = {
  empty: "Sin datos para este periodo",
  loading: "Cargando gráfico",
  resetZoom: "Ver todo",
  total: "Total",
  explore: "Velas. Usa las flechas para recorrerlas.",
  brush: "Rango visible",
  category: "Fecha",
};

const spanishTexts = {
  open: "Apertura",
  high: "Máximo",
  low: "Mínimo",
  close: "Cierre",
  volume: "Unidades",
  change: "Variación",
  up: "Sube",
  down: "Baja",
};

const meta = {
  title: "Charts/CandlestickChart",
  component: CandlestickChart,
  tags: ["autodocs"],
  args: {
    title: "Precio semanal de la pomada (S/ por unidad)",
    data: insumo,
    valueFormat: "currency",
    volumeFormat: "integer",
    height: 380,
    candleStyle: "filled",
    brush: false,
    lastPrice: true,
    grid: true,
    legend: true,
    tooltip: true,
    loading: false,
    animate: true,
    texts: spanishTexts,
    labels: spanishLabels,
  },
  argTypes: {
    candleStyle: { control: "inline-radio", options: ["filled", "hollow"] },
    volume: { control: "boolean" },
    valueFormat: { control: "select", options: ["number", "currency", "compact"] },
    data: { control: false },
    upColor: { control: "text" },
    downColor: { control: "text" },
    height: { control: { type: "range", min: 220, max: 600, step: 10 } },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 900, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CandlestickChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const BrushZoom: Story = { args: { brush: true } };

export const Hollow: Story = { args: { candleStyle: "hollow", brush: true } };

export const PriceOnly: Story = { args: { volume: false } };

export const DailyCash: Story = {
  args: {
    title: "Caja diaria: apertura, máximo, mínimo y cierre",
    data: caja,
    texts: { ...spanishTexts, volume: "Movimientos" },
  },
};

export const Loading: Story = { args: { loading: true } };

export const Empty: Story = { args: { data: [] } };

export const Narrow: Story = {
  args: { brush: true },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};
