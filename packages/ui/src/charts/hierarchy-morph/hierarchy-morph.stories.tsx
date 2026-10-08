import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import type { HierarchyDatum } from "../core/hierarchy.js";
import { HierarchyMorph, type HierarchyMorphMode } from "./hierarchy-morph.js";

/** Ventas del mes (S/) por categoría y servicio. */
const sales: HierarchyDatum = {
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
        { name: "Perfilado", value: 2960 },
        { name: "Afeitado clásico", value: 1740 },
        { name: "Toalla caliente", value: 1210 },
      ],
    },
    {
      name: "Productos",
      children: [
        { name: "Cera mate", value: 1480 },
        { name: "Pomada", value: 1120 },
        { name: "Shampoo", value: 860 },
        { name: "Aceite", value: 790 },
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
  total: "Total",
  explore: "Categorías y servicios. Usa las flechas para recorrerlos.",
  category: "Categoría y servicio",
  share: "Participación",
  view: "Vista del gráfico",
  treemap: "Mapa",
  sunburst: "Anillos",
};

const meta = {
  title: "Charts/HierarchyMorph",
  component: HierarchyMorph,
  tags: ["autodocs"],
  args: {
    title: "Ventas por categoría y servicio",
    data: sales,
    valueFormat: "currency",
    defaultMode: "treemap",
    levels: 2,
    showSwitch: true,
    height: 400,
    gap: 2,
    sort: true,
    tooltip: true,
    animate: true,
    loading: false,
    labels: spanishLabels,
  },
  argTypes: {
    mode: { control: "inline-radio", options: [undefined, "treemap", "sunburst"] },
    defaultMode: { control: "inline-radio", options: ["treemap", "sunburst"] },
    levels: { control: "inline-radio", options: [1, 2] },
    height: { control: { type: "range", min: 240, max: 560, step: 10 } },
    gap: { control: { type: "range", min: 0, max: 6, step: 1 } },
    data: { control: false },
    labels: { control: false },
    onModeChange: { control: false },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 760, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HierarchyMorph>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Press "Anillos": every rectangle bends into its ring segment, and back again. */
export const Default: Story = {};

export const StartsAsSunburst: Story = { args: { defaultMode: "sunburst" } };

export const OneLevel: Story = { args: { levels: 1 } };

/** The mode lives outside: any control can drive the morph. */
export const Controlled: Story = {
  args: { showSwitch: false },
  render: (args) => {
    const [mode, setMode] = useState<HierarchyMorphMode>("treemap");
    return (
      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={mode === "sunburst"}
            onChange={(event) => setMode(event.target.checked ? "sunburst" : "treemap")}
          />
          Ver como anillos
        </label>
        <HierarchyMorph {...args} mode={mode} />
      </div>
    );
  },
};

export const Loading: Story = { args: { loading: true } };

export const Empty: Story = { args: { data: { name: "Ventas de octubre", children: [] } } };

/** 320 px container: labels hide where they do not fit. */
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
