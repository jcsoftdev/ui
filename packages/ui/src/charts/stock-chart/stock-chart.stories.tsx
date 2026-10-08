import type { Meta, StoryObj } from "@storybook/react-vite";
import { type StockBar, StockChart, type StockComparison, type StockFlag } from "./stock-chart.js";

/** Deterministic pseudo-random sequence so stories never change between renders. */
function sequence(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/** Business days (Monday to Saturday) from 1 dec 2025 to 7 oct 2026. */
const days: Date[] = [];
for (let d = new Date(2025, 11, 1); d <= new Date(2026, 9, 7); d.setDate(d.getDate() + 1)) {
  if (d.getDay() !== 0) days.push(new Date(d));
}

function prices(start: number, drift: number, swing: number, seed: number): StockBar[] {
  const random = sequence(seed);
  let price = start;
  return days.map((date, i) => {
    const open = price;
    const trend = Math.sin(i / 38) * swing * 0.35 + drift;
    const close = Math.max(swing, open + trend + (random() - 0.5) * swing * 2);
    const high = Math.max(open, close) + random() * swing * 0.8;
    const low = Math.max(swing * 0.5, Math.min(open, close) - random() * swing * 0.8);
    price = close;
    const round = (value: number) => Math.round(value * 100) / 100;
    return {
      date,
      open: round(open),
      high: round(high),
      low: round(low),
      close: round(close),
      volume: Math.round(60 + random() * 240 + (Math.abs(close - open) / swing) * 120),
    };
  });
}

/** Price of a box of imported straight razors, S/ per box. */
const navajas = prices(84, 0.06, 1.4, 11);
const pomada = prices(42, 0.02, 0.8, 5);
const aceite = prices(31, -0.01, 0.6, 29);

const comparisons: StockComparison[] = [
  { id: "pomada", name: "Pomada mate", values: pomada.map((bar) => bar.close) },
  { id: "aceite", name: "Aceite para barba", values: aceite.map((bar) => bar.close) },
];

const flags: StockFlag[] = [
  {
    date: new Date(2026, 1, 16),
    label: "P",
    text: "Pedido grande para la sede Miraflores",
    tone: "accent",
  },
  {
    date: new Date(2026, 4, 4),
    label: "D",
    text: "Descuento del proveedor por volumen",
    tone: "success",
  },
  {
    date: new Date(2026, 6, 20),
    label: "A",
    text: "Alza de aranceles de importación",
    tone: "danger",
  },
  {
    date: new Date(2026, 8, 14),
    label: "N",
    text: "Nuevo proveedor en evaluación",
    tone: "warning",
  },
];

const spanishRanges = [
  { id: "1s", label: "1S", unit: "week", count: 1, description: "Última semana" },
  { id: "1m", label: "1M", unit: "month", count: 1, description: "Último mes" },
  { id: "3m", label: "3M", unit: "month", count: 3, description: "Últimos 3 meses" },
  { id: "6m", label: "6M", unit: "month", count: 6, description: "Últimos 6 meses" },
  { id: "1a", label: "1A", unit: "year", count: 1, description: "Último año" },
  { id: "todo", label: "Todo", unit: "all", description: "Todo el periodo" },
] as const;

const spanishLabels = {
  empty: "Sin precios para este periodo",
  loading: "Cargando precios",
  explore: "Precios por día. Usa las flechas para recorrerlos.",
  brush: "Periodo visible",
  category: "Fecha",
};

const spanishTexts = {
  open: "Apertura",
  high: "Máximo",
  low: "Mínimo",
  close: "Cierre",
  volume: "Cajas vendidas",
  change: "Variación",
  price: "Navajas importadas",
  ranges: "Periodo",
  seriesTypes: "Tipo de gráfico",
  seriesTypeNames: { candle: "Velas", ohlc: "Barras OHLC", line: "Línea", area: "Área" },
  signal: "Señal",
  histogram: "Histograma",
  events: "Eventos",
};

const meta = {
  title: "Charts/StockChart",
  component: StockChart,
  tags: ["autodocs"],
  args: {
    title: "Precio de la caja de navajas importadas (S/)",
    data: navajas,
    ranges: [...spanishRanges],
    defaultRange: "6m",
    defaultSeriesType: "candle",
    overlays: [
      { type: "sma", period: 20 },
      { type: "ema", period: 50 },
    ],
    oscillator: { type: "rsi", period: 14 },
    valueFormat: "currency",
    volumeFormat: "integer",
    height: 440,
    navigator: true,
    lastPrice: true,
    grid: true,
    legend: true,
    tooltip: true,
    toolbar: true,
    loading: false,
    animate: true,
    texts: spanishTexts,
    labels: spanishLabels,
  },
  argTypes: {
    data: { control: false },
    overlays: { control: false },
    comparisons: { control: false },
    flags: { control: false },
    ranges: { control: false },
    defaultSeriesType: { control: "inline-radio", options: ["candle", "ohlc", "line", "area"] },
    height: { control: { type: "range", min: 260, max: 640, step: 10 } },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 960, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StockChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const OhlcBollinger: Story = {
  args: {
    defaultSeriesType: "ohlc",
    defaultRange: "3m",
    overlays: [{ type: "bollinger", period: 20, deviations: 2 }],
    oscillator: undefined,
  },
};

export const LineMacd: Story = {
  args: {
    defaultSeriesType: "line",
    defaultRange: "1a",
    overlays: [
      { type: "ema", period: 12 },
      { type: "ema", period: 26 },
    ],
    oscillator: { type: "macd" },
  },
};

export const AreaVwap: Story = {
  args: {
    defaultSeriesType: "area",
    defaultRange: "1m",
    overlays: [{ type: "vwap" }],
    oscillator: undefined,
  },
};

/** Comparing switches the axis to % change from the first visible day. */
export const Comparison: Story = {
  args: {
    title: "Variación de precios de insumos",
    name: "Navajas importadas",
    comparisons,
    overlays: [],
    oscillator: undefined,
    defaultRange: "todo",
  },
};

export const Flags: Story = {
  args: {
    flags,
    defaultRange: "todo",
    oscillator: undefined,
    overlays: [{ type: "sma", period: 50 }],
  },
};

export const Loading: Story = { args: { loading: true } };

export const Empty: Story = { args: { data: [] } };

export const Narrow: Story = {
  args: { height: 380 },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};

/** Drag the corner: price, oscillator and navigator share the box exactly. */
export const FillParent: Story = {
  args: { height: "fill" },
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div
        style={{
          width: 640,
          height: 460,
          resize: "both",
          overflow: "hidden",
          outline: "1px dashed var(--line-strong)",
        }}
      >
        <Story />
      </div>
    ),
  ],
};
