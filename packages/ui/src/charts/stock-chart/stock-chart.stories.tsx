import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ComponentProps, useEffect, useRef, useState } from "react";
import {
  DEFAULT_STOCK_TOOLS,
  type StockBar,
  StockChart,
  type StockComparison,
  type StockDrawing,
  type StockFlag,
  type StockWindow,
  stockStats,
  useStockStream,
} from "./stock-chart.js";

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
  seriesTypeNames: {
    candle: "Velas",
    ohlc: "Barras OHLC",
    line: "Línea",
    area: "Área",
    column: "Columnas",
    "heikin-ashi": "Heikin-Ashi",
    renko: "Renko",
  },
  signal: "Señal",
  histogram: "Histograma",
  events: "Eventos",
  tools: "Herramientas de dibujo",
  toolNames: {
    cursor: "Seleccionar",
    trend: "Línea de tendencia",
    horizontal: "Línea horizontal",
    range: "Rango",
    fib: "Retroceso de Fibonacci",
    measure: "Medir",
  },
  deleteDrawing: "Borrar el dibujo seleccionado",
  bars: "barras",
  days: "d",
  drawingLayer: "Zona de dibujo",
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
    defaultSeriesType: {
      control: "select",
      options: ["candle", "ohlc", "line", "area", "column", "heikin-ashi", "renko"],
    },
    drawingTools: { control: false },
    drawings: { control: false },
    defaultDrawings: { control: false },
    defaultPinned: { control: false },
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

/** Smoothed candles: each one opens at the middle of the previous one. */
export const HeikinAshi: Story = {
  args: { defaultSeriesType: "heikin-ashi", defaultRange: "6m", oscillator: undefined },
};

/** Bricks of a fixed size (the 14-day ATR unless `renkoBrickSize` is set): time disappears, only moves count. */
export const Renko: Story = {
  args: { defaultSeriesType: "renko", defaultRange: "todo", oscillator: undefined, overlays: [] },
};

export const Columns: Story = {
  args: { defaultSeriesType: "column", defaultRange: "3m", oscillator: undefined, overlays: [] },
};

function LiveChart(args: ComponentProps<typeof StockChart>) {
  const { data, appendData } = useStockStream(navajas.slice(-90), { maxBars: 140 });
  const [running, setRunning] = useState(true);
  const latest = useRef(data);
  latest.current = data;
  useEffect(() => {
    if (!running) return;
    const random = sequence(77);
    let ticks = 0;
    const timer = setInterval(() => {
      ticks += 1;
      const last = latest.current[latest.current.length - 1] as StockBar;
      const move = (random() - 0.5) * 1.6;
      if (ticks % 6 === 0) {
        const date = new Date(last.date);
        date.setDate(date.getDate() + 1);
        const close = Math.round((last.close + move) * 100) / 100;
        appendData({
          date,
          open: last.close,
          high: Math.max(last.close, close),
          low: Math.min(last.close, close),
          close,
          volume: 40,
        });
        return;
      }
      const close = Math.round((last.close + move) * 100) / 100;
      appendData({
        ...last,
        close,
        high: Math.max(last.high, close),
        low: Math.min(last.low, close),
        volume: (last.volume ?? 0) + Math.round(random() * 30),
      });
    }, 450);
    return () => clearInterval(timer);
  }, [running, appendData]);
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setRunning((value) => !value)}
        className="self-start rounded-pill bg-surface-2 px-3 py-1 font-semibold text-[12px] text-ink"
      >
        {running ? "Pausar" : "Reanudar"}
      </button>
      <StockChart {...args} data={data} />
    </div>
  );
}

/** A new tick every 450 ms updates the forming candle; each 6th starts a new day. The window follows the tail. */
export const Streaming: Story = {
  args: { defaultRange: "1m", overlays: [{ type: "sma", period: 10 }], oscillator: undefined },
  render: (args) => <LiveChart {...args} />,
};

const sampleDrawings: StockDrawing[] = [
  {
    id: "tendencia",
    type: "trend",
    a: { time: +days[days.length - 150], price: 86 },
    b: { time: +days[days.length - 40], price: 108 },
  },
  { id: "soporte", type: "horizontal", price: 92 },
  {
    id: "fibonacci",
    type: "fib",
    a: { time: +days[days.length - 120], price: 118 },
    b: { time: +days[days.length - 70], price: 90 },
  },
];

function DrawingStory(args: ComponentProps<typeof StockChart>) {
  const [saved, setSaved] = useState<StockDrawing[]>(args.defaultDrawings?.slice() ?? []);
  return (
    <div className="flex flex-col gap-3">
      <StockChart {...args} onDrawingsChange={setSaved} />
      <p className="m-0 text-[12px] text-ink-3">
        Dibujos guardados por <code>onDrawingsChange</code>: {saved.length}
        {saved.length ? ` (${saved.map((d) => d.type).join(", ")})` : ""}. Elige una herramienta y
        arrastra sobre el precio; selecciona un dibujo y pulsa Supr para borrarlo.
      </p>
    </div>
  );
}

export const DrawingTools: Story = {
  args: {
    drawingTools: DEFAULT_STOCK_TOOLS.filter((tool) => tool !== "measure"),
    defaultDrawings: sampleDrawings,
    defaultRange: "6m",
    oscillator: undefined,
  },
  render: (args) => <DrawingStory {...args} />,
};

/** Arrastra con la regla: variación %, barras y días entre los dos extremos. */
export const RangeMeasure: Story = {
  args: {
    drawingTools: ["cursor", "measure"],
    defaultRange: "6m",
    oscillator: undefined,
    overlays: [],
  },
};

/** Clic (o Enter) en una barra fija su tooltip; fija varias para comparar días. */
export const PinnedTooltips: Story = {
  args: {
    pinnable: true,
    defaultPinned: [+days[days.length - 90], +days[days.length - 30]],
    defaultRange: "6m",
    oscillator: undefined,
    overlays: [],
  },
};

function StatsStory(args: ComponentProps<typeof StockChart>) {
  const [window_, setWindow] = useState<StockWindow | null>(null);
  const stats = window_ ? stockStats(navajas.slice(window_.from, window_.to + 1)) : null;
  const percent = (value: number) => `${value > 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
  const tiles: Array<[string, string]> = stats
    ? [
        ["Variación", percent(stats.changePercent)],
        ["Volatilidad anual", `${(stats.annualizedVolatility * 100).toFixed(1)}%`],
        ["Máximo", `S/ ${stats.high.price.toFixed(2)}`],
        ["Mínimo", `S/ ${stats.low.price.toFixed(2)}`],
        ["Caída máxima", `-${(stats.maxDrawdown.depth * 100).toFixed(1)}%`],
        ["Mejor día", percent(stats.bestDay.change)],
        ["Peor día", percent(stats.worstDay.change)],
        ["Cajas vendidas", stats.totalVolume.toLocaleString("es-PE")],
      ]
    : [];
  return (
    <div className="@container/stats flex flex-col gap-3">
      <StockChart {...args} onWindowChange={setWindow} />
      <dl className="m-0 grid grid-cols-2 gap-2 @md/stats:grid-cols-4">
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded-event bg-surface-2 px-3 py-2">
            <dt className="text-[11px] text-ink-3">{label}</dt>
            <dd className="m-0 font-bold text-[15px] text-ink tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** `stockStats(data)` on the visible window: change the range or drag the navigator and the panel follows. */
export const Stats: Story = {
  args: { defaultRange: "6m", oscillator: undefined, overlays: [] },
  render: (args) => <StatsStory {...args} />,
};
