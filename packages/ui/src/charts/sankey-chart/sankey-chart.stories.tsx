import type { Meta, StoryObj } from "@storybook/react-vite";
import type { SankeyLinkInput, SankeyNodeInput } from "../core/sankey.js";
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
