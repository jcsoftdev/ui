import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import { formatCurrency } from "../core/format.js";
import { DonutChart, type DonutDatum } from "./donut-chart.js";

const services = [
  { id: "corte", name: "Corte clásico", value: 4200 },
  { id: "degradado", name: "Degradado", value: 3650 },
  { id: "corte-barba", name: "Corte + barba", value: 2980 },
  { id: "barba", name: "Perfilado de barba", value: 1450 },
  { id: "tinte", name: "Tinte", value: 920 },
  { id: "lavado", name: "Lavado y peinado", value: 380 },
];

const spanishLabels = {
  empty: "Sin datos para este periodo",
  loading: "Cargando gráfico",
  total: "Total",
  explore: "Porciones del gráfico. Usa las flechas para recorrerlas.",
  category: "Servicio",
  value: "Ingresos",
  share: "Participación",
};

const meta = {
  title: "Charts/DonutChart",
  component: DonutChart,
  tags: ["autodocs"],
  args: {
    title: "Ingresos por servicio en octubre",
    data: services,
    valueFormat: "currency",
    variant: "donut",
    semi: false,
    innerRadius: 0.62,
    cornerRadius: 6,
    gap: 3,
    explode: 8,
    startAngle: 0,
    outsideLabels: false,
    height: 320,
    tooltip: true,
    loading: false,
    animate: true,
    labels: spanishLabels,
  },
  argTypes: {
    variant: { control: "inline-radio", options: ["donut", "pie"] },
    semi: { control: "boolean" },
    innerRadius: { control: { type: "range", min: 0.3, max: 0.85, step: 0.01 } },
    cornerRadius: { control: { type: "range", min: 0, max: 20, step: 1 } },
    gap: { control: { type: "range", min: 0, max: 12, step: 1 } },
    explode: { control: { type: "range", min: 0, max: 20, step: 1 } },
    startAngle: { control: { type: "range", min: -180, max: 180, step: 5 } },
    monochrome: { control: "boolean" },
    fill: { control: "inline-radio", options: ["solid", "gradient", "pattern"] },
    outsideLabels: { control: "select", options: [false, true, "name", "percent", "both"] },
    sliceLabels: { control: "select", options: [false, true, "percent", "value"] },
    legend: { control: "select", options: [true, false, "top", "bottom"] },
    height: { control: { type: "range", min: 200, max: 520, step: 10 } },
    data: { control: false },
    onSliceClick: { control: false },
    labels: { control: false },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 720, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DonutChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const OutsideLabels: Story = {
  args: { outsideLabels: "both", height: 360, cornerRadius: 8 },
};

export const SliceLabels: Story = {
  args: { sliceLabels: "percent", height: 340, gap: 2, innerRadius: 0.5 },
};

export const SliceValues: Story = {
  args: { sliceLabels: "value", variant: "pie", height: 340 },
};

export const OutsidePercentOnly: Story = {
  args: { outsideLabels: "percent", legend: "top", gap: 5 },
};

export const SemiDonut: Story = {
  args: {
    title: "Citas por estado hoy",
    semi: true,
    height: 240,
    valueFormat: "integer",
    centerLabel: "Citas",
    data: [
      { id: "atendidas", name: "Atendidas", value: 18 },
      { id: "confirmadas", name: "Confirmadas", value: 9 },
      { id: "pendientes", name: "Pendientes", value: 6 },
      { id: "canceladas", name: "Canceladas", value: 2 },
    ],
    labels: { ...spanishLabels, value: "Citas" },
  },
};

export const SemiWithOutsideLabels: Story = {
  args: { ...SemiDonut.args, outsideLabels: true, height: 280 },
};

export const SharpThinRing: Story = {
  args: { innerRadius: 0.8, cornerRadius: 0, gap: 2, explode: 4 },
};

export const CustomCenter: Story = {
  args: {
    centerValue: formatCurrency(13580),
    centerLabel: "Facturado en octubre",
  },
};

export const Monochrome: Story = {
  args: { monochrome: true, title: "Ingresos por servicio (un solo tono)" },
};

/** Each slice fades from the hole towards the rim. */
export const Gradient: Story = {
  args: { fill: "gradient", title: "Ingresos por servicio con degradado", gap: 4 },
};

/** A texture per slice: the legend color is no longer the only cue (colour-blind friendly). */
export const Textured: Story = {
  args: { fill: "pattern", title: "Ingresos por servicio con texturas", cornerRadius: 3, gap: 4 },
};

const nextWeek: DonutDatum[] = [
  { id: "corte", name: "Corte clásico", value: 3100 },
  { id: "degradado", name: "Degradado", value: 4900 },
  { id: "corte-barba", name: "Corte + barba", value: 2200 },
  { id: "barba", name: "Perfilado de barba", value: 1900 },
  { id: "tinte", name: "Tinte", value: 1500 },
  { id: "lavado", name: "Lavado y peinado", value: 120 },
];

/** Press the button (or let it auto-refresh): slices grow and shrink, the centre total counts along. */
export const Update: Story = {
  render: (args) => {
    const [week, setWeek] = useState(0);
    const [auto, setAuto] = useState(false);
    useEffect(() => {
      if (!auto) return;
      const timer = setInterval(() => setWeek((current) => current + 1), 2200);
      return () => clearInterval(timer);
    }, [auto]);
    const data = week % 2 === 0 ? services : nextWeek;
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md border border-line px-3 py-1 text-[13px]"
            onClick={() => setWeek((current) => current + 1)}
          >
            Cambiar de semana
          </button>
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={auto}
              onChange={(event) => setAuto(event.target.checked)}
            />
            Actualizar solo
          </label>
        </div>
        <DonutChart {...args} data={data} />
      </div>
    );
  },
};

const branches: DonutDatum[] = [
  {
    id: "miraflores",
    name: "Miraflores",
    value: 0,
    children: [
      { id: "mf-cortes", name: "Cortes", value: 5200 },
      { id: "mf-barba", name: "Barba", value: 2600 },
      { id: "mf-color", name: "Color", value: 1300 },
      { id: "mf-productos", name: "Productos", value: 900 },
    ],
  },
  {
    id: "san-isidro",
    name: "San Isidro",
    value: 0,
    children: [
      { id: "si-cortes", name: "Cortes", value: 4300 },
      { id: "si-barba", name: "Barba", value: 1900 },
      { id: "si-combos", name: "Combos", value: 2400 },
    ],
  },
  {
    id: "surco",
    name: "Surco",
    value: 0,
    children: [
      { id: "su-cortes", name: "Cortes", value: 3100 },
      { id: "su-barba", name: "Barba", value: 1100 },
    ],
  },
];

/** Click a sede to open its services in the same ring; the breadcrumb (or Escape) goes back. */
export const Drilldown: Story = {
  args: {
    title: "Ingresos por sede",
    rootLabel: "Todas las sedes",
    breadcrumbLabel: "Ruta del gráfico",
    data: branches.map((branch) => ({
      ...branch,
      value: (branch.children ?? []).reduce((sum, child) => sum + child.value, 0),
    })),
    centerLabel: "Facturado",
    outsideLabels: "name",
    height: 340,
  },
};

export const HiddenSlices: Story = {
  parameters: { a11y: { test: "todo" } },
  args: { initialHidden: ["lavado", "tinte"] },
};

export const Loading: Story = { args: { loading: true } };

export const Empty: Story = { args: { data: [] } };

/** 320 px container: outside labels give way to the legend, the centre text scales. */
export const Narrow: Story = {
  args: { outsideLabels: true, height: 300 },
  decorators: [
    (Story) => (
      <div style={{ width: 320, maxWidth: "100%" }}>
        <Story />
      </div>
    ),
  ],
};

/** Drag the corner: the chart fills the box exactly, width and height. */
export const FillParent: Story = {
  args: { height: "fill" },
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div
        style={{
          width: 560,
          height: 360,
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

/** The centre figure and caption shrink to the hole of a small ring instead of overflowing it. */
export const SmallRingLongValue: Story = {
  args: { centerValue: "S/ 29 950.00", centerLabel: "Total del mes", height: 200 },
  decorators: [
    (Story) => (
      <div style={{ width: 240, maxWidth: "100%" }}>
        <Story />
      </div>
    ),
  ],
};
