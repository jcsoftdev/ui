import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChordChart, type ChordGroupInput, type ChordLabels } from "./chord-chart.js";

/** Clientes que cambiaron de barbero entre septiembre y octubre (fila: de, columna: hacia). */
const barberos: ChordGroupInput[] = [
  { id: "kevin", name: "Kevin" },
  { id: "diego", name: "Diego" },
  { id: "andrea", name: "Andrea" },
  { id: "luis", name: "Luis" },
  { id: "renzo", name: "Renzo" },
];

const cambios = [
  [0, 14, 6, 3, 2],
  [9, 0, 4, 11, 1],
  [5, 3, 0, 2, 8],
  [2, 12, 3, 0, 6],
  [1, 2, 9, 7, 0],
];

const spanishLabels: Partial<ChordLabels> = {
  empty: "Sin cambios de barbero en este periodo",
  loading: "Cargando cambios de barbero",
  explore:
    "Cambios de barbero. Izquierda y derecha para moverte entre barberos, Escape limpia. Las cintas muestran cuántos clientes pasan de uno a otro.",
  category: "De",
  from: "De",
  to: "Hacia",
  inflow: "Llegan",
  outflow: "Se van",
  exportTexts: { export: "Exportar", svg: "SVG", png: "PNG" },
};

const meta = {
  title: "Charts/ChordChart",
  component: ChordChart,
  tags: ["autodocs"],
  args: {
    title: "Clientes que cambian de barbero",
    description: "Octubre frente a septiembre",
    groups: barberos,
    matrix: cambios,
    padAngle: 3,
    startAngle: 0,
    ringWidth: 0.09,
    sortGroups: "input",
    sortSubgroups: "descending",
    showLabels: true,
    valueFormat: "integer",
    height: 440,
    legend: true,
    tooltip: true,
    animate: true,
    loading: false,
    labels: spanishLabels,
  },
  argTypes: {
    groups: { control: false },
    matrix: { control: false },
    sortGroups: { control: "inline-radio", options: ["input", "ascending", "descending"] },
    sortSubgroups: { control: "inline-radio", options: ["input", "ascending", "descending"] },
    padAngle: { control: { type: "range", min: 0, max: 10, step: 0.5 } },
    ringWidth: { control: { type: "range", min: 0.03, max: 0.4, step: 0.01 } },
    height: { control: { type: "range", min: 240, max: 640, step: 10 } },
    valueFormat: { control: "inline-radio", options: ["integer", "currency", "compact"] },
    onGroupClick: { control: false },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 720 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ChordChart>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Hover a barbero to light who leaves and who arrives, a ribbon to see both directions. */
export const Default: Story = {};

/** Biggest group first, thin ring. */
export const Sorted: Story = {
  args: { sortGroups: "descending", ringWidth: 0.05, padAngle: 5 },
};

/** Services that clients take together in one visit (symmetric: both ends of a ribbon match). */
export const Services: Story = {
  args: {
    title: "Servicios que se combinan en una visita",
    groups: [
      { id: "corte", name: "Corte" },
      { id: "barba", name: "Barba" },
      { id: "cejas", name: "Cejas" },
      { id: "color", name: "Color" },
      { id: "masaje", name: "Masaje facial" },
    ],
    matrix: [
      [0, 120, 34, 18, 22],
      [120, 0, 15, 4, 31],
      [34, 15, 0, 6, 3],
      [18, 4, 6, 0, 2],
      [22, 31, 3, 2, 0],
    ],
    sortGroups: "descending",
  },
};

export const Loading: Story = { args: { loading: true } };

export const Empty: Story = { args: { matrix: [] } };

export const Export: Story = { args: { exportable: true } };

export const Dark: Story = { globals: { theme: "dark" } };

/** 320 px container: the names move to the legend. */
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

/** Takes the exact size of a resizable parent. */
export const FillParent: Story = {
  args: { height: "fill" },
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div
        style={{
          width: 560,
          height: 420,
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
