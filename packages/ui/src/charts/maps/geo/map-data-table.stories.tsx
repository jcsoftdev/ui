import type { Meta, StoryObj } from "@storybook/react-vite";
import { type MapDataRow, MapDataTable } from "./map-data-table.js";
import { DEFAULT_MAP_LABELS } from "./map-labels.js";

const labels = {
  ...DEFAULT_MAP_LABELS,
  noData: "Sin datos",
  region: "Distrito",
  share: "Participación",
  sortBy: (column: string) => `Ordenar por ${column}`,
};

const data: Array<[string, string, number | null]> = [
  ["miraflores", "Miraflores", 182],
  ["san-isidro", "San Isidro", 143],
  ["surco", "Santiago de Surco", 121],
  ["barranco", "Barranco", 76],
  ["la-molina", "La Molina", 64],
  ["lince", "Lince", 31],
  ["callao", "Callao", null],
];

const rows: MapDataRow[] = data.map(([id, name, value]) => ({
  id,
  name,
  value,
  display: value == null ? "" : `${value} citas`,
  color:
    value == null
      ? "var(--surface-2)"
      : `color-mix(in oklab, var(--chart-cat-1) ${Math.round((value / 182) * 80) + 20}%, var(--surface))`,
}));

const meta = {
  title: "Charts/Primitives/MapDataTable",
  component: MapDataTable,
  tags: ["autodocs"],
  args: {
    caption: "Citas por distrito",
    rows,
    valueName: "Citas",
    labels,
    height: 280,
  },
  argTypes: {
    rows: { control: "object" },
    labels: { control: false },
    onRowClick: { action: "row" },
    height: { control: { type: "number", min: 120 } },
  },
} satisfies Meta<typeof MapDataTable>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Sortable table with the numbers behind the colors; regions without data sort last. */
export const Default: Story = {};

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};
