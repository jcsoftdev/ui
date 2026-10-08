import type { Meta, StoryObj } from "@storybook/react-vite";
import type { HierarchyDatum } from "../core/hierarchy.js";
import { TreemapChart } from "./treemap-chart.js";

/** Ventas del mes (S/) por categoría y producto o servicio. */
const salesByCategory: HierarchyDatum = {
  name: "Ventas de octubre",
  children: [
    {
      name: "Cortes",
      children: [
        { name: "Corte clásico", value: 6480 },
        { name: "Degradado", value: 5320 },
        { name: "Corte infantil", value: 1890 },
        { name: "Rapado", value: 760 },
      ],
    },
    {
      name: "Barba",
      children: [
        { name: "Perfilado de barba", value: 2960 },
        { name: "Afeitado clásico", value: 1740 },
        { name: "Barba con toalla caliente", value: 1210 },
      ],
    },
    {
      name: "Productos",
      children: [
        { name: "Cera mate", value: 1480 },
        { name: "Pomada", value: 1120 },
        { name: "Shampoo", value: 860 },
        { name: "Aceite para barba", value: 790 },
        { name: "Aftershave", value: 430 },
        { name: "Peine de madera", value: 180 },
      ],
    },
    {
      name: "Color",
      children: [
        { name: "Tinte", value: 1650 },
        { name: "Mechas", value: 980 },
      ],
    },
    {
      name: "Combos",
      children: [
        { name: "Corte + barba", value: 3870 },
        { name: "Novio VIP", value: 900 },
      ],
    },
  ],
};

const spanishLabels = {
  empty: "Sin ventas en este periodo",
  loading: "Cargando ventas",
  resetZoom: "Ver todo",
  total: "Total",
  explore:
    "Categorías de ventas. Usa las flechas para moverte, Enter para abrir y Escape para volver.",
  brush: "Rango visible",
  category: "Categoría",
  breadcrumb: "Ruta de la vista",
  share: "Participación",
  drillHint: "Clic para ver el detalle",
};

const meta = {
  title: "Charts/TreemapChart",
  component: TreemapChart,
  tags: ["autodocs"],
  args: {
    title: "Ventas por categoría y producto",
    data: salesByCategory,
    valueFormat: "currency",
    height: 380,
    depth: 2,
    drillDown: true,
    breadcrumb: true,
    legend: true,
    tooltip: true,
    gap: 3,
    radius: 6,
    sort: true,
    animate: true,
    loading: false,
    labels: spanishLabels,
  },
  argTypes: {
    valueFormat: {
      control: "inline-radio",
      options: ["currency", "compact", "integer", "number"],
    },
    depth: { control: { type: "range", min: 1, max: 3, step: 1 } },
    height: { control: { type: "range", min: 200, max: 560, step: 10 } },
    gap: { control: { type: "range", min: 0, max: 8, step: 1 } },
    radius: { control: { type: "range", min: 0, max: 14, step: 1 } },
    data: { control: false },
    onFocusChange: { control: false },
    onNodeClick: { control: false },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 820, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TreemapChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** One level only: each category is a single cell; click to open it. */
export const TopLevel: Story = {
  args: { depth: 1 },
};

export const DataOrder: Story = {
  args: { sort: false, gap: 2, radius: 3 },
};

export const WithoutLegend: Story = {
  args: { legend: false, breadcrumb: false, drillDown: false },
};

export const Loading: Story = {
  args: { loading: true },
};

export const Empty: Story = {
  args: { data: { name: "Ventas de octubre", children: [] } },
};

/** 320 px container: labels hide where they do not fit, legend below the drawing. */
export const Narrow: Story = {
  args: { height: 320 },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};
