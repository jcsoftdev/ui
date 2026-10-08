import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { FileTree } from "./file-tree.js";
import type { FileTreeNode } from "./model.js";

const nodes: FileTreeNode[] = [
  {
    id: "clientes",
    name: "Clientes",
    children: [
      { id: "lista", name: "lista-clientes.csv" },
      {
        id: "fotos",
        name: "Fotos de cortes",
        children: [
          { id: "f1", name: "degradado-luis.jpg" },
          { id: "f2", name: "barba-marco.png" },
        ],
      },
      { id: "notas", name: "notas-de-estilo.md" },
    ],
  },
  {
    id: "finanzas",
    name: "Finanzas",
    children: [
      { id: "ingresos", name: "ingresos-octubre.csv" },
      { id: "yape", name: "reporte-yape.pdf" },
      { id: "vacia", name: "Archivadas", children: [] },
    ],
  },
  { id: "inventario", name: "inventario.json" },
  { id: "horarios", name: "horarios-barberos.txt" },
];

const meta = {
  title: "Containers/FileTree",
  component: FileTree,
  tags: ["autodocs"],
  args: {
    nodes,
    label: "Archivos de la barbería",
    defaultExpandedIds: ["clientes"],
    defaultSelectedId: "lista",
  },
  argTypes: {
    label: { control: "text" },
    nodes: { control: false },
    selectedId: { control: false },
    expandedIds: { control: false },
    onSelect: { control: false },
    onExpandedChange: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-sm rounded-card border-card surface-card p-density shadow-card">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FileTree>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Controlled: Story = {
  render: function Render(args) {
    const [selected, setSelected] = useState<string | null>("yape");
    return (
      <div className="flex flex-col gap-density-sm">
        <FileTree
          {...args}
          selectedId={selected}
          onSelect={setSelected}
          defaultExpandedIds={["finanzas"]}
        />
        <p className="m-0 text-ink-3 text-meta">Seleccionado: {selected}</p>
      </div>
    );
  },
};

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="w-[320px] max-w-full">
        <Story />
      </div>
    ),
  ],
  args: { defaultExpandedIds: ["clientes", "fotos"] },
};

export const BrutalPreset: Story = {
  decorators: [
    (Story) => (
      <div data-style="brutal" className="bg-bg p-card">
        <Story />
      </div>
    ),
  ],
};
