import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { AnalyticsBento } from "./analytics-bento.js";
import { SectionHeading } from "./bento.js";
import { ControlsBento } from "./controls-bento.js";
import { DataVizBento } from "./dataviz-bento.js";
import { OperationsBento } from "./operations-bento.js";
import { ShowcaseShell } from "./shell.js";

function Page({ title, children }: { title: string; children: ReactNode }) {
  return <ShowcaseShell title={title}>{children}</ShowcaseShell>;
}

const meta = {
  title: "Showcase/Bento",
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Galerías bento hechas solo con componentes reales de la librería. Cada tile usa los tokens de rol (surface-card, border-card, shadow-card, rounded-card, p-card, gap-density), así que el estilo, la densidad, el radio y el acento restyle la página completa. La rejilla responde al ancho de su contenedor (6, 4, 2 y 1 columnas), nunca al viewport. La barra superior aplica estilo y densidad en el contenedor y tema y acento en <html>.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Hero KPI, 30-day area chart with a record annotation, donut, sparklines, calendar heatmap, gauge, Peru map and ranking. */
export const Analitica: Story = {
  render: () => (
    <Page title="Analítica">
      <AnalyticsBento />
    </Page>
  ),
};

/** Week agenda, activity timeline, live chairs, Kanban and a DataGrid with pinned column and ActionBar. */
export const Operaciones: Story = {
  parameters: { a11y: { test: "todo" } },
  render: () => (
    <Page title="Operaciones">
      <OperationsBento />
    </Page>
  ),
};

/** Treemap, sunburst, Sankey, radar, Gantt, candlestick, tree, scatter, bubble, polar area, waffle and pictogram. */
export const GaleriaDeGraficos: Story = {
  parameters: { a11y: { test: "todo" } },
  name: "Galería de gráficos",
  render: () => (
    <Page title="Gráficos">
      <DataVizBento />
    </Page>
  ),
};

/** Buttons, segmented, switches, inputs, chips, accent picker, dialog, carousel, file tree, resizable panels and hover card. */
export const Controles: Story = {
  parameters: { a11y: { test: "todo" } },
  render: () => (
    <Page title="Controles">
      <ControlsBento />
    </Page>
  ),
};

/** The four grids stacked under section headings, with the sticky preset bar at the top. */
export const Overview: Story = {
  parameters: { a11y: { test: "todo" } },
  render: () => (
    <Page title="Barbería Don Lucho · Showcase">
      <SectionHeading
        eyebrow="01 · Analítica"
        title="El negocio de un vistazo"
        lede="Ventas, ocupación y alcance geográfico con los gráficos de la librería, todos al ancho de su tile."
      />
      <AnalyticsBento />
      <SectionHeading
        eyebrow="02 · Operaciones"
        title="El día en la barbería"
        lede="Agenda semanal, flujo del sillón, actividad en vivo y la lista de citas con acciones masivas."
      />
      <OperationsBento />
      <SectionHeading
        eyebrow="03 · Visualización"
        title="Una familia de gráficos para cada pregunta"
        lede="Jerarquías, flujos, tiempos, distribuciones y unidades en tiles de tamaños distintos."
      />
      <DataVizBento />
      <SectionHeading
        eyebrow="04 · Controles"
        title="Todo lo que se toca"
        lede="Botones, formularios, carrusel, árbol de archivos, paneles redimensionables y overlays."
      />
      <ControlsBento />
    </Page>
  ),
};
