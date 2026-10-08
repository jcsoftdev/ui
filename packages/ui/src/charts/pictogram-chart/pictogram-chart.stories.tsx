import type { Meta, StoryObj } from "@storybook/react-vite";
import { UnitGlyph } from "../core/unit-glyph.js";
import {
  BARBER_SILHOUETTES,
  PICTOGRAM_SILHOUETTES,
  resolveUnitShape,
  UNIT_ICONS,
} from "../core/unit-icons.js";
import { PictogramChart } from "./pictogram-chart.js";

const visitsBySegment = [
  { id: "nuevos", name: "Clientes nuevos", value: 18 },
  { id: "frecuentes", name: "Frecuentes", value: 42 },
  { id: "vip", name: "Membresía VIP", value: 11 },
];

const servicesSold = [
  { id: "cortes", name: "Cortes", value: 186, icon: "scissors" as const },
  { id: "barbas", name: "Barbas", value: 97, icon: "person" as const },
  { id: "productos", name: "Productos", value: 64, icon: "bottle" as const },
];

/** A comb drawn as a custom path: any SVG path works ("bring your own shape"). */
const comb = {
  path: "M3 4h18a1 1 0 0 1 1 1v4H2V5a1 1 0 0 1 1-1zM3 10h1.6v10H3zM6.2 10h1.6v10H6.2zM9.4 10h1.6v10H9.4zM12.6 10h1.6v10h-1.6zM15.8 10h1.6v10h-1.6zM19 10h1.6v10H19z",
};

const spanishLabels = {
  empty: "Sin datos para mostrar",
  loading: "Cargando gráfico",
  resetZoom: "Ver todo",
  total: "Total",
  explore: "Categorías del gráfico. Usa las flechas para recorrerlas.",
  brush: "Rango visible",
  category: "Segmento",
};

const meta = {
  title: "Charts/PictogramChart",
  component: PictogramChart,
  tags: ["autodocs"],
  args: {
    title: "Clientes atendidos hoy",
    data: visitsBySegment,
    perUnit: 1,
    icon: "person",
    layout: "grid",
    unitSize: 28,
    gap: 0.25,
    height: 200,
    unitLabel: "clientes",
    valueFormat: "integer",
    legend: true,
    tooltip: true,
    animate: true,
    loading: false,
    labels: spanishLabels,
  },
  argTypes: {
    icon: {
      control: "select",
      options: Object.keys(UNIT_ICONS),
    },
    layout: { control: "inline-radio", options: ["grid", "rows"] },
    legend: { control: "select", options: [true, false, "top", "bottom"] },
    perUnit: { control: { type: "number", min: 0.5, step: 0.5 } },
    unitSize: { control: { type: "range", min: 12, max: 56, step: 1 } },
    gap: { control: { type: "range", min: 0, max: 0.8, step: 0.05 } },
    height: { control: { type: "range", min: 120, max: 420, step: 10 } },
    data: { control: false },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 760, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PictogramChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const PartialUnits: Story = {
  name: "Partial units (1 icon = 5)",
  args: {
    title: "Servicios vendidos en la semana",
    data: servicesSold.map(({ icon: _icon, ...item }) => item),
    perUnit: 5,
    icon: "scissors",
    unitLabel: "servicios",
    labels: { ...spanishLabels, category: "Servicio" },
  },
};

export const Rows: Story = {
  name: "Rows layout, icon per category",
  args: {
    title: "Ventas por tipo (1 ícono = 10)",
    data: servicesSold,
    perUnit: 10,
    layout: "rows",
    unitLabel: "ventas",
    height: 150,
  },
};

export const Capacity: Story = {
  name: "Capacity (empty units)",
  args: {
    title: "Sillas ocupadas el sábado",
    data: [
      { id: "reservas", name: "Con reserva", value: 9 },
      { id: "sin-cita", name: "Sin cita", value: 4 },
    ],
    total: 16,
    icon: "chair",
    unitSize: 40,
    unitLabel: "sillas",
    height: 110,
  },
};

export const CustomShape: Story = {
  name: "Custom SVG shape",
  args: {
    title: "Peines vendidos por sede",
    data: [
      { id: "miraflores", name: "Miraflores", value: 23 },
      { id: "surco", name: "Surco", value: 15 },
    ],
    icon: comb,
    unitLabel: "peines",
    labels: { ...spanishLabels, category: "Sede" },
  },
};

const SIZE = 56;

function Gallery({ names }: { names: readonly (keyof typeof UNIT_ICONS)[] }) {
  return (
    <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-3 p-0">
      {names.map((name) => (
        <li
          key={name}
          className="flex flex-col items-center gap-1 rounded-md border border-line p-2"
        >
          <svg
            width={SIZE * 2 + 8}
            height={SIZE}
            role="img"
            aria-label={name}
            className="max-w-full"
          >
            <UnitGlyph
              shape={resolveUnitShape(name)}
              x={0}
              y={0}
              size={SIZE}
              fill={1}
              color="var(--accent-word)"
              clipId={`full-${name}`}
            />
            <UnitGlyph
              shape={resolveUnitShape(name)}
              x={SIZE + 8}
              y={0}
              size={SIZE}
              fill={0.6}
              color="var(--accent-word)"
              clipId={`part-${name}`}
            />
          </svg>
          <code className="text-[11px] text-ink-3">{name}</code>
        </li>
      ))}
    </ul>
  );
}

/** Built-in silhouettes, each full and cut at 60%. Pass the name as `icon`, or any SVG path of your own. */
export const Silhouettes: Story = {
  render: () => (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <h3 className="m-0 text-[13px] font-bold text-ink">Personas y cosas de todos los días</h3>
        <Gallery names={PICTOGRAM_SILHOUETTES} />
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="m-0 text-[13px] font-bold text-ink">Barbería</h3>
        <Gallery names={BARBER_SILHOUETTES} />
      </section>
    </div>
  ),
};

/** A family of silhouettes in one chart: a different one per category. */
export const MixedSilhouettes: Story = {
  args: {
    title: "Clientes por tipo (1 figura = 2)",
    data: [
      { id: "hombres", name: "Hombres", value: 24, icon: "person" as const },
      { id: "mujeres", name: "Mujeres", value: 9, icon: "woman" as const },
      { id: "ninos", name: "Niños", value: 13, icon: "child" as const },
    ],
    perUnit: 2,
    layout: "rows",
    unitLabel: "clientes",
    height: 170,
    labels: { ...spanishLabels, category: "Tipo" },
  },
};

export const Loading: Story = { args: { loading: true } };

export const Empty: Story = { args: { data: [] } };

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 320, maxWidth: "100%" }}>
        <Story />
      </div>
    ),
  ],
  args: { title: "Servicios vendidos", data: servicesSold, perUnit: 10, unitLabel: "ventas" },
};
