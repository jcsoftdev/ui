import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import type { HierarchyDatum } from "../core/hierarchy.js";
import { SunburstChart } from "./sunburst-chart.js";

/** Servicios atendidos en el mes por sede, barbero y servicio. */
const servicesByBranch: HierarchyDatum = {
  name: "Servicios de octubre",
  children: [
    {
      name: "Miraflores",
      children: [
        {
          name: "Kevin",
          children: [
            { name: "Corte clásico", value: 64 },
            { name: "Degradado", value: 48 },
            { name: "Barba", value: 22 },
          ],
        },
        {
          name: "Renzo",
          children: [
            { name: "Degradado", value: 57 },
            { name: "Corte + barba", value: 31 },
            { name: "Tinte", value: 9 },
          ],
        },
      ],
    },
    {
      name: "Barranco",
      children: [
        {
          name: "Abel",
          children: [
            { name: "Corte clásico", value: 42 },
            { name: "Afeitado", value: 26 },
          ],
        },
        {
          name: "Diego",
          children: [
            { name: "Degradado", value: 38 },
            { name: "Corte infantil", value: 17 },
            { name: "Barba", value: 15 },
          ],
        },
      ],
    },
    {
      name: "San Isidro",
      children: [
        {
          name: "Luis",
          children: [
            { name: "Corte + barba", value: 35 },
            { name: "Corte clásico", value: 29 },
          ],
        },
      ],
    },
  ],
};

const spanishLabels = {
  empty: "Sin servicios en este periodo",
  loading: "Cargando servicios",
  resetZoom: "Ver todo",
  total: "Total",
  explore:
    "Segmentos del gráfico. Usa las flechas para moverte, Enter para abrir y Escape para volver.",
  brush: "Rango visible",
  category: "Sede, barbero y servicio",
  breadcrumb: "Ruta de la vista",
  share: "Participación",
  drillHint: "Clic para acercar",
};

const meta = {
  title: "Charts/SunburstChart",
  component: SunburstChart,
  tags: ["autodocs"],
  args: {
    title: "Servicios por sede, barbero y servicio",
    data: servicesByBranch,
    valueFormat: "integer",
    height: 380,
    half: false,
    levels: 3,
    drillDown: true,
    breadcrumb: true,
    legend: true,
    tooltip: true,
    centerLabel: true,
    segmentLabels: true,
    gap: 1.5,
    sort: true,
    animate: true,
    loading: false,
    labels: spanishLabels,
  },
  argTypes: {
    valueFormat: { control: "inline-radio", options: ["integer", "compact", "number"] },
    half: { control: "boolean" },
    levels: { control: { type: "range", min: 1, max: 4, step: 1 } },
    height: { control: { type: "range", min: 220, max: 560, step: 10 } },
    gap: { control: { type: "range", min: 0, max: 6, step: 0.5 } },
    data: { control: false },
    onFocusChange: { control: false },
    onNodeClick: { control: false },
  },
  // The rings fade in over 760 ms; axe sampling a half-faded label reads a false contrast failure.
  play: async ({ canvasElement }) => {
    const finite = canvasElement.ownerDocument
      .getAnimations()
      .filter(
        (animation) =>
          animation.effect?.getComputedTiming().iterations !== Number.POSITIVE_INFINITY,
      );
    await Promise.allSettled(finite.map((animation) => animation.finished));
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 760, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SunburstChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Two rings at a time: deeper levels appear while zooming in. */
export const TwoLevels: Story = {
  args: { levels: 2 },
};

export const WithoutLabels: Story = {
  args: { segmentLabels: false, gap: 3 },
};

export const StaticView: Story = {
  args: { drillDown: false, legend: false },
};

/** Click a segment to zoom in; the breadcrumb, the centre or Escape zoom back out. The focus is reported below. */
export const Drilldown: Story = {
  args: { levels: 2, height: 400 },
  render: (args) => {
    const [focus, setFocus] = useState("Todas las sedes");
    return (
      <div className="flex flex-col gap-2">
        <SunburstChart
          {...args}
          onFocusChange={(node) =>
            setFocus(node.parent ? `${node.name} (${node.value})` : "Todas las sedes")
          }
        />
        <p className="m-0 text-[13px] text-ink-3">Vista abierta: {focus}</p>
      </div>
    );
  },
};

/** A 180 degree fan: the same partition on a half disc, with the title and total above the baseline. */
export const SemiCircle: Story = {
  args: { half: true, height: 280, levels: 3 },
};

export const SemiCircleNarrow: Story = {
  args: { half: true, height: 200, legend: false },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};

export const Loading: Story = {
  args: { loading: true },
};

export const Empty: Story = {
  args: { data: { name: "Servicios de octubre", children: [] } },
};

/** 320 px container: the disc shrinks, segment labels hide, legend below. */
export const Narrow: Story = {
  args: { height: 300 },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};
