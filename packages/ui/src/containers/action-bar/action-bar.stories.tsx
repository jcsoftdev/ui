import type { Meta, StoryObj } from "@storybook/react-vite";
import { Archive, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "../../atoms/button/button.js";
import { ActionBar } from "./action-bar.js";

const clientes = [
  "Luis Ramírez",
  "Marco Salazar",
  "Andrés Paredes",
  "Jorge Castillo",
  "Renzo Vargas",
];

const meta = {
  title: "Containers/ActionBar",
  component: ActionBar,
  tags: ["autodocs"],
  args: { selectedCount: 3, position: "absolute" },
  argTypes: {
    selectedCount: { control: { type: "number", min: 0 } },
    position: { control: "inline-radio", options: ["absolute", "fixed", "static"] },
    noun: { control: false },
    onClear: { control: false },
  },
} satisfies Meta<typeof ActionBar>;

export default meta;
type Story = StoryObj<typeof meta>;

function Demo({ width }: { width?: string }) {
  const [selected, setSelected] = useState<string[]>(["Luis Ramírez", "Renzo Vargas"]);
  const toggle = (name: string) =>
    setSelected((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  return (
    <div
      className="relative flex min-h-72 max-w-full flex-col gap-density-sm rounded-card border-card bg-surface-card p-card pb-24 shadow-card"
      style={{ width }}
    >
      <p className="m-0 text-ink-3 text-meta">Elige clientes; la barra aparece con la selección.</p>
      {clientes.map((name) => (
        <label
          key={name}
          className="flex cursor-pointer items-center gap-density text-body text-ink"
        >
          <input type="checkbox" checked={selected.includes(name)} onChange={() => toggle(name)} />
          {name}
        </label>
      ))}
      <ActionBar
        selectedCount={selected.length}
        noun={["cliente", "clientes"]}
        onClear={() => setSelected([])}
      >
        <Button size="sm" variant="primary">
          <Send aria-hidden="true" /> Enviar promo
        </Button>
        <Button size="sm">
          <Archive aria-hidden="true" /> Archivar
        </Button>
        <Button size="sm" variant="danger">
          <Trash2 aria-hidden="true" /> Eliminar
        </Button>
      </ActionBar>
    </div>
  );
}

export const Default: Story = { render: () => <Demo width="32rem" /> };

export const Narrow: Story = { render: () => <Demo width="320px" /> };

export const BrutalPreset: Story = {
  render: () => (
    <div data-style="brutal">
      <Demo width="32rem" />
    </div>
  ),
};

export const GlassPreset: Story = {
  render: () => (
    <div data-style="glass">
      <Demo width="32rem" />
    </div>
  ),
};
