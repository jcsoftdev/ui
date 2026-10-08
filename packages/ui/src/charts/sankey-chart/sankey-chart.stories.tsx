import type { Meta, StoryObj } from "@storybook/react-vite";
import type { SankeyLinkInput, SankeyNodeInput } from "../core/sankey.js";
import { AlluvialChart } from "./alluvial-chart.js";
import { SankeyChart, type SankeyLabels } from "./sankey-chart.js";

/** Clientes de octubre: cómo llegaron, qué servicio tomaron y cómo pagaron. */
const nodes: SankeyNodeInput[] = [
  { id: "instagram", name: "Instagram" },
  { id: "referidos", name: "Referidos" },
  { id: "google", name: "Google Maps" },
  { id: "paso", name: "Paso por la tienda" },
  { id: "corte", name: "Corte" },
  { id: "barba", name: "Barba" },
  { id: "combo", name: "Corte + barba" },
  { id: "color", name: "Color" },
  { id: "yape", name: "Yape / Plin" },
  { id: "tarjeta", name: "Tarjeta" },
  { id: "efectivo", name: "Efectivo" },
];

const links: SankeyLinkInput[] = [
  { source: "instagram", target: "corte", value: 142 },
  { source: "instagram", target: "combo", value: 64 },
  { source: "instagram", target: "color", value: 28 },
  { source: "referidos", target: "corte", value: 88 },
  { source: "referidos", target: "barba", value: 41 },
  { source: "referidos", target: "combo", value: 37 },
  { source: "google", target: "corte", value: 56 },
  { source: "google", target: "barba", value: 22 },
  { source: "paso", target: "corte", value: 47 },
  { source: "paso", target: "barba", value: 29 },
  { source: "paso", target: "color", value: 9 },
  { source: "corte", target: "yape", value: 196 },
  { source: "corte", target: "tarjeta", value: 78 },
  { source: "corte", target: "efectivo", value: 59 },
  { source: "barba", target: "yape", value: 51 },
  { source: "barba", target: "efectivo", value: 41 },
  { source: "combo", target: "tarjeta", value: 58 },
  { source: "combo", target: "yape", value: 43 },
  { source: "color", target: "tarjeta", value: 25 },
  { source: "color", target: "yape", value: 12 },
];

const spanishLabels: Partial<SankeyLabels> = {
  empty: "Sin clientes en este periodo",
  loading: "Cargando flujo de clientes",
  explore:
    "Flujo de clientes. Arriba y abajo para moverte en una columna, izquierda y derecha entre columnas, Enter recorre los flujos del nodo y Escape limpia.",
  category: "Flujo",
  value: "Clientes",
  source: "Desde",
  target: "Hacia",
  ofSource: "Parte de",
  ofTotal: "Parte del total",
  incoming: "Entran",
  outgoing: "Salen",
  before: "Antes",
  after: "Después",
  change: "Cambio",
  increase: "Sube",
  decrease: "Baja",
  previous: "Periodo anterior",
  exportTexts: { export: "Exportar", svg: "SVG", png: "PNG" },
};

/** Septiembre: el mismo recorrido, con menos Instagram y sin color en el pago por tarjeta. */
const septiembre: SankeyLinkInput[] = [
  { source: "instagram", target: "corte", value: 118 },
  { source: "instagram", target: "combo", value: 39 },
  { source: "instagram", target: "color", value: 31 },
  { source: "referidos", target: "corte", value: 95 },
  { source: "referidos", target: "barba", value: 33 },
  { source: "referidos", target: "combo", value: 29 },
  { source: "google", target: "corte", value: 61 },
  { source: "google", target: "barba", value: 22 },
  { source: "paso", target: "corte", value: 52 },
  { source: "paso", target: "barba", value: 36 },
  { source: "paso", target: "color", value: 14 },
  { source: "corte", target: "yape", value: 174 },
  { source: "corte", target: "tarjeta", value: 71 },
  { source: "corte", target: "efectivo", value: 81 },
  { source: "barba", target: "yape", value: 44 },
  { source: "barba", target: "efectivo", value: 47 },
  { source: "combo", target: "tarjeta", value: 40 },
  { source: "combo", target: "yape", value: 28 },
  { source: "color", target: "tarjeta", value: 33 },
  { source: "color", target: "efectivo", value: 12 },
];

/** Segmentos de clientes mes a mes: quién pasa de nuevo a regular, de regular a VIP o se pierde. */
const segmentos = {
  stages: ["Jul", "Ago", "Sep", "Oct"],
  categories: [
    { id: "vip", name: "VIP", color: "var(--chart-cat-3)" },
    { id: "regular", name: "Regulares" },
    { id: "nuevo", name: "Nuevos", color: "var(--chart-cat-2)" },
    { id: "inactivo", name: "Inactivos", color: "var(--ink-3)" },
  ],
  flows: [
    [
      { from: "vip", to: "vip", value: 42 },
      { from: "vip", to: "regular", value: 6 },
      { from: "regular", to: "vip", value: 14 },
      { from: "regular", to: "regular", value: 118 },
      { from: "regular", to: "inactivo", value: 22 },
      { from: "nuevo", to: "regular", value: 31 },
      { from: "nuevo", to: "inactivo", value: 17 },
      { from: "inactivo", to: "regular", value: 9 },
      { from: "inactivo", to: "inactivo", value: 40 },
    ],
    [
      { from: "vip", to: "vip", value: 51 },
      { from: "vip", to: "regular", value: 5 },
      { from: "regular", to: "vip", value: 18 },
      { from: "regular", to: "regular", value: 124 },
      { from: "regular", to: "inactivo", value: 20 },
      { from: "nuevo", to: "regular", value: 36 },
      { from: "nuevo", to: "inactivo", value: 14 },
      { from: "inactivo", to: "regular", value: 12 },
      { from: "inactivo", to: "inactivo", value: 47 },
    ],
    [
      { from: "vip", to: "vip", value: 62 },
      { from: "vip", to: "regular", value: 7 },
      { from: "regular", to: "vip", value: 16 },
      { from: "regular", to: "regular", value: 139 },
      { from: "regular", to: "inactivo", value: 18 },
      { from: "nuevo", to: "regular", value: 44 },
      { from: "nuevo", to: "inactivo", value: 12 },
      { from: "inactivo", to: "regular", value: 15 },
      { from: "inactivo", to: "inactivo", value: 50 },
    ],
  ],
};

const meta = {
  title: "Charts/SankeyChart",
  component: SankeyChart,
  tags: ["autodocs"],
  args: {
    title: "Origen de clientes, servicio y medio de pago",
    nodes,
    links,
    columns: ["Origen", "Servicio", "Pago"],
    valueFormat: "integer",
    height: 400,
    nodePadding: 14,
    align: "justify",
    iterations: 6,
    linkColor: "gradient",
    linkOpacity: 0.38,
    labelPosition: "outside",
    showValues: true,
    tooltip: true,
    animate: true,
    loading: false,
    labels: spanishLabels,
  },
  argTypes: {
    linkColor: { control: "inline-radio", options: ["gradient", "source", "target", "neutral"] },
    labelPosition: { control: "inline-radio", options: ["outside", "inside"] },
    align: { control: "inline-radio", options: ["justify", "left"] },
    valueFormat: { control: "inline-radio", options: ["integer", "currency", "compact"] },
    height: { control: { type: "range", min: 220, max: 640, step: 10 } },
    nodePadding: { control: { type: "range", min: 2, max: 40, step: 1 } },
    iterations: { control: { type: "range", min: 0, max: 32, step: 1 } },
    linkOpacity: { control: { type: "range", min: 0.1, max: 0.9, step: 0.02 } },
    nodes: { control: false },
    links: { control: false },
    onNodeClick: { control: false },
    onLinkClick: { control: false },
    onRemovedLinks: { control: false },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 880 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SankeyChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Links take the color of where the clients came from. */
export const SourceColored: Story = {
  args: { linkColor: "source", linkOpacity: 0.32 },
};

/** Wide bars with the label and value on them. */
export const InsideLabels: Story = {
  args: { labelPosition: "inside", linkColor: "target" },
};

/** Ingresos en soles por el mismo recorrido. */
export const Revenue: Story = {
  args: {
    title: "Ingresos por origen, servicio y medio de pago",
    valueFormat: "currency",
    labels: { ...spanishLabels, value: "Ingresos" },
    links: links.map((link) => ({
      ...link,
      value:
        link.value *
        (link.target === "color" || link.source === "color"
          ? 95
          : link.target === "combo" || link.source === "combo"
            ? 55
            : link.target === "barba" || link.source === "barba"
              ? 25
              : 35),
    })),
  },
};

/**
 * "Vuelve a reservar" closes a loop back to the origin: the layout leaves that
 * link out and warns in development instead of drawing an impossible flow.
 */
export const WithCycle: Story = {
  args: {
    links: [...links, { source: "yape", target: "referidos", value: 30 }],
  },
};

export const Loading: Story = {
  args: { loading: true },
};

export const Empty: Story = {
  args: { links: [] },
};

/** 320 px container: labels shorten or hide, and a node legend appears under the drawing. */
export const Narrow: Story = {
  args: { height: 340 },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};

/** Takes the exact size of a resizable parent, legend included. */
export const FillParent: Story = {
  args: { height: "fill" },
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div
        style={{
          width: 640,
          height: 380,
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

/** Clients keep their segment color and their row from month to month. */
export const Alluvial: Story = {
  render: () => (
    <AlluvialChart
      title="Segmentos de clientes, de julio a octubre"
      {...segmentos}
      valueFormat="integer"
      height={420}
      labels={spanishLabels}
    />
  ),
};

/** October against September: bands colored by change, the grey ghost behind is the previous width. */
export const Diff: Story = {
  args: {
    title: "Octubre frente a septiembre",
    compare: septiembre,
    linkColor: "gradient",
    height: 440,
  },
};

/** Hover a band or a bar to light every path through it; click to pin it, click again to release. */
export const PathTracing: Story = {
  args: { pathTracing: true, linkColor: "source", linkOpacity: 0.28 },
};

/** Dots travel along the bands. They stop under `prefers-reduced-motion` and are left out of the SVG export. */
export const Particles: Story = {
  args: { particles: true, linkColor: "source", linkOpacity: 0.3, pathTracing: true },
};

/** The SVG and PNG buttons download the drawing as it is on screen. */
export const Export: Story = {
  args: { exportable: true, compare: septiembre },
};
