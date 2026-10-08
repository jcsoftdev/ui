import type { Meta, StoryObj } from "@storybook/react-vite";
import type { HierarchyDatum } from "../core/hierarchy.js";
import { IcicleChart } from "./icicle-chart.js";

/** Ingresos del mes (S/) por sede, barbero y servicio. */
const revenueByBranch: HierarchyDatum = {
  name: "Ingresos de octubre",
  children: [
    {
      name: "Miraflores",
      children: [
        {
          name: "Kevin",
          children: [
            { name: "Corte clásico", value: 2240 },
            { name: "Degradado", value: 1920 },
            { name: "Barba", value: 550 },
          ],
        },
        {
          name: "Renzo",
          children: [
            { name: "Degradado", value: 2280 },
            { name: "Corte + barba", value: 1705 },
            { name: "Tinte", value: 540 },
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
            { name: "Corte clásico", value: 1470 },
            { name: "Afeitado", value: 780 },
          ],
        },
        {
          name: "Diego",
          children: [
            { name: "Degradado", value: 1520 },
            { name: "Corte infantil", value: 425 },
            { name: "Barba", value: 375 },
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
            { name: "Corte + barba", value: 1925 },
            { name: "Corte clásico", value: 1015 },
          ],
        },
      ],
    },
  ],
};

const spanishLabels = {
  empty: "Sin ingresos en este periodo",
  loading: "Cargando ingresos",
  resetZoom: "Ver todo",
  total: "Total",
  explore:
    "Bloques del gráfico. Usa las flechas para moverte, Enter para abrir y Escape para volver.",
  brush: "Rango visible",
  category: "Sede, barbero y servicio",
  breadcrumb: "Ruta de la vista",
  share: "Participación",
  drillHint: "Clic para acercar",
};

const meta = {
  title: "Charts/IcicleChart",
  component: IcicleChart,
  tags: ["autodocs"],
  args: {
    title: "Ingresos por sede, barbero y servicio",
    data: revenueByBranch,
    valueFormat: "currency",
    orientation: "horizontal",
    height: 360,
    levels: 3,
    drillDown: true,
    breadcrumb: true,
    legend: true,
    tooltip: true,
    gap: 2,
    radius: 4,
    sort: true,
    animate: true,
    loading: false,
    labels: spanishLabels,
  },
  argTypes: {
    orientation: { control: "inline-radio", options: ["horizontal", "vertical"] },
    valueFormat: { control: "inline-radio", options: ["currency", "compact", "integer"] },
    levels: { control: { type: "range", min: 1, max: 4, step: 1 } },
    height: { control: { type: "range", min: 200, max: 560, step: 10 } },
    gap: { control: { type: "range", min: 0, max: 6, step: 1 } },
    radius: { control: { type: "range", min: 0, max: 10, step: 1 } },
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
} satisfies Meta<typeof IcicleChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Vertical: Story = {
  args: { orientation: "vertical", height: 320 },
};

export const TwoLevels: Story = {
  args: { levels: 2 },
};

export const Loading: Story = {
  args: { loading: true },
};

export const Empty: Story = {
  args: { data: { name: "Ingresos de octubre", children: [] } },
};

/** 320 px container: deepest band dropped so names stay readable, legend below. */
export const Narrow: Story = {
  args: { height: 380, valueFormat: "compact" },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};
