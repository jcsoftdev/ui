import type { Meta, StoryObj } from "@storybook/react-vite";
import { seededRandom } from "../core/distribution/stats.js";
import type { XYPoint } from "../core/distribution/xy-points.js";
import { formatNumber, type ValueFormat } from "../core/format.js";
import { ScatterChart } from "./scatter-chart.js";

const minutes = (value: number) => `${formatNumber(value, { maximumFractionDigits: 0 })} min`;

/** Service duration (x) vs. ticket (y): longer services cost more, with noise. */
function visits(seed: number, count: number, base: number, perMinute: number): XYPoint[] {
  const random = seededRandom(seed);
  return Array.from({ length: count }, () => {
    const duration = Math.round(15 + random() * 55);
    const noise = (random() - 0.5) * 22;
    return { x: duration, y: Math.round(base + duration * perMinute + noise) };
  });
}

const spanishLabels = {
  empty: "Sin atenciones en este periodo",
  loading: "Cargando gráfico",
  explore: "Puntos del gráfico. Usa las flechas para recorrerlos.",
  series: "Servicio",
  point: "Atención",
};

const meta = {
  title: "Charts/ScatterChart",
  component: ScatterChart,
  tags: ["autodocs"],
  args: {
    title: "Duración del servicio vs. ticket",
    series: [
      { id: "corte", name: "Corte", points: visits(401, 60, 10, 0.75) },
      { id: "combo", name: "Corte + barba", points: visits(402, 45, 22, 0.9) },
    ],
    xFormat: minutes as ValueFormat,
    yFormat: "currency",
    xAxis: { title: "Duración (min)" },
    yAxis: { title: "Ticket (S/)" },
    trendLine: false,
    radius: 5,
    height: 340,
    grid: true,
    tooltip: true,
    loading: false,
    animate: true,
    labels: spanishLabels,
  },
  argTypes: {
    radius: { control: { type: "range", min: 2, max: 9, step: 0.5 } },
    legend: { control: "select", options: [true, false, "top", "bottom"] },
    height: { control: { type: "range", min: 200, max: 560, step: 10 } },
    xFormat: { control: false },
    yFormat: { control: false },
    series: { control: false },
    quadrants: { control: false },
    renderer: { control: "inline-radio", options: ["svg", "canvas"] },
    xType: { control: "inline-radio", options: ["linear", "time"] },
    jitter: { control: { type: "range", min: 0, max: 14, step: 1 } },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 760, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ScatterChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithTrendLines: Story = { args: { trendLine: true } };

const barberPoints: XYPoint[] = [
  { label: "Kevin", x: 28, y: 4.8 },
  { label: "Renzo", x: 24, y: 4.3 },
  { label: "Abel", x: 37, y: 4.9 },
  { label: "Diego", x: 31, y: 3.9 },
  { label: "Luis", x: 42, y: 4.6 },
  { label: "Marco", x: 22, y: 3.6 },
  { label: "Jhon", x: 35, y: 4.1 },
];

export const Quadrants: Story = {
  args: {
    title: "Rapidez vs. satisfacción por barbero",
    series: [{ id: "barberos", name: "Barberos", points: barberPoints }],
    xFormat: minutes as ValueFormat,
    yFormat: (value: number) => formatNumber(value, { maximumFractionDigits: 1 }),
    xAxis: { title: "Duración media (min)" },
    yAxis: { title: "Calificación", min: 3, max: 5 },
    radius: 7,
    quadrants: {
      x: 30,
      y: 4.3,
      labels: {
        topLeft: "Rápidos y bien valorados",
        topRight: "Detallistas",
        bottomLeft: "Rápidos, revisar calidad",
        bottomRight: "A capacitar",
      },
      tones: { topLeft: "success", bottomRight: "danger" },
    },
  },
};

/** x holds epoch milliseconds; `xType="time"` draws a calendar axis. */
function appointments(seed: number, days: number, perDay: number, base: number): XYPoint[] {
  const random = seededRandom(seed);
  const start = new Date(2026, 9, 1).getTime();
  const out: XYPoint[] = [];
  for (let day = 0; day < days; day += 1) {
    for (let n = 0; n < perDay; n += 1) {
      const hour = 9 + random() * 10;
      out.push({
        x: start + day * 86_400_000 + hour * 3_600_000,
        y: Math.round(base + (hour > 15 ? 8 : 0) + random() * 28),
      });
    }
  }
  return out;
}

export const Datetime: Story = {
  args: {
    title: "Ticket de cada atención en octubre",
    series: [
      { id: "corte", name: "Corte", points: appointments(411, 21, 3, 22) },
      { id: "combo", name: "Corte + barba", points: appointments(412, 21, 2, 38) },
    ],
    xType: "time",
    xFormat: undefined,
    xAxis: { title: "Fecha" },
    radius: 4,
  },
};

/** Durations are rounded to 5 minutes, so many visits sit on top of each other. */
function rounded(seed: number, count: number, base: number, perMinute: number): XYPoint[] {
  return visits(seed, count, base, perMinute).map((point) => ({
    x: Math.round(point.x / 5) * 5,
    y: Math.round(point.y / 5) * 5,
  }));
}

export const Jitter: Story = {
  args: {
    title: "Atenciones redondeadas, separadas con dispersión",
    series: [
      { id: "corte", name: "Corte", points: rounded(421, 90, 10, 0.75) },
      { id: "combo", name: "Corte + barba", points: rounded(422, 70, 22, 0.9) },
    ],
    jitter: 7,
    radius: 4.5,
  },
  argTypes: { jitter: { control: { type: "range", min: 0, max: 14, step: 1 } } },
};

/** Inline SVG avatar: a tinted disc with initials. No network involved. */
function avatar(initials: string, hue: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="hsl(${hue} 55% 42%)"/><circle cx="32" cy="26" r="12" fill="hsl(${hue} 60% 78%)"/><path d="M8 64c2-16 14-22 24-22s22 6 24 22z" fill="hsl(${hue} 60% 78%)"/><text x="32" y="38" text-anchor="middle" font-family="sans-serif" font-size="15" font-weight="700" fill="hsl(${hue} 55% 22%)">${initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const WithImages: Story = {
  args: {
    title: "Rapidez vs. satisfacción con la foto de cada barbero",
    series: [
      {
        id: "barberos",
        name: "Barberos",
        points: barberPoints.map((point, index) => ({
          ...point,
          image: avatar((point.label ?? "?").slice(0, 2).toUpperCase(), 20 + index * 47),
        })),
      },
    ],
    xFormat: minutes as ValueFormat,
    yFormat: (value: number) => formatNumber(value, { maximumFractionDigits: 1 }),
    xAxis: { title: "Duración media (min)", min: 15, max: 50 },
    yAxis: { title: "Calificación", min: 3, max: 5 },
    radius: 17,
    legend: false,
  },
};

/** 50 000 atenciones painted on a canvas; hover and keyboard still work. */
function dense(seed: number, count: number, cx: number, cy: number): XYPoint[] {
  const random = seededRandom(seed);
  return Array.from({ length: count }, () => {
    const u = Math.max(1e-9, random());
    const v = random();
    const r = Math.sqrt(-2 * Math.log(u));
    return {
      x: cx + r * Math.cos(2 * Math.PI * v) * 9,
      y: cy + r * Math.sin(2 * Math.PI * v) * 11 + r * Math.cos(2 * Math.PI * v) * 3,
    };
  });
}

export const Canvas50k: Story = {
  args: {
    title: "50 000 atenciones del año",
    series: [
      { id: "corte", name: "Corte", points: dense(431, 30_000, 32, 38) },
      { id: "combo", name: "Corte + barba", points: dense(432, 20_000, 48, 62) },
    ],
    renderer: "canvas",
    radius: 1.6,
    height: 420,
    animate: false,
  },
};

export const Narrow: Story = {
  args: { trendLine: true },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};

export const Loading: Story = { args: { loading: true } };

export const Empty: Story = { args: { series: [{ id: "corte", name: "Corte", points: [] }] } };
