import type { Meta, StoryObj } from "@storybook/react-vite";
import { Calendar, Package, Scissors, UserRound } from "lucide-react";
import { useState } from "react";
import { fn } from "storybook/test";
import { CommandPalette, type CommandPaletteItem } from "./command-palette.js";

const items: CommandPaletteItem[] = [
  {
    id: "nueva-cita",
    label: "Nueva cita",
    group: "Acciones",
    icon: <Calendar aria-hidden />,
    hint: "N",
    keywords: ["reserva", "agendar"],
    onSelect: fn(),
  },
  {
    id: "cobrar",
    label: "Cobrar servicio",
    group: "Acciones",
    icon: <Scissors aria-hidden />,
    hint: "S/ 35",
    keywords: ["caja", "pago"],
    onSelect: fn(),
  },
  {
    id: "marco",
    label: "Marco Ríos",
    group: "Clientes",
    icon: <UserRound aria-hidden />,
    hint: "Último corte: 12 sep",
    onSelect: fn(),
  },
  {
    id: "lucho",
    label: "Lucho Vargas",
    group: "Clientes",
    icon: <UserRound aria-hidden />,
    hint: "Último corte: 28 sep",
    onSelect: fn(),
  },
  {
    id: "pomada",
    label: "Pomada mate",
    group: "Inventario",
    icon: <Package aria-hidden />,
    hint: "4 en stock",
    onSelect: fn(),
  },
];

const meta = {
  title: "Palette/CommandPalette",
  component: CommandPalette,
  tags: ["autodocs"],
  args: {
    open: true,
    onClose: fn(),
    items,
    label: "Buscar en la barbería",
    placeholder: "Buscar clientes, servicios o acciones...",
    emptyLabel: "Sin resultados",
    formatResultCount: (count: number) => `${count} resultados`,
    closeKeyLabel: "Esc",
  },
  argTypes: {
    open: { control: "boolean" },
    onClose: { control: false },
    items: { control: "object" },
    label: { control: "text" },
    placeholder: { control: "text" },
    emptyLabel: { control: "text" },
    formatResultCount: { control: false },
    closeKeyLabel: { control: "text" },
    query: { control: "text" },
    onQueryChange: { control: false },
    className: { control: false },
  },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof CommandPalette>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = { parameters: { a11y: { test: "todo" } }, args: { items: [] } };

export const CustomCloseKey: Story = { args: { closeKeyLabel: "Cerrar" } };

function ControlledQueryDemo() {
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState("marco");
  return (
    <div className="p-6">
      <button
        type="button"
        className="rounded-control border border-line px-3 py-1.5 text-body"
        onClick={() => setOpen(true)}
      >
        Abrir buscador
      </button>
      <p className="mt-3 text-ink-2 text-meta">Búsqueda: {query || "(vacía)"}</p>
      <CommandPalette
        open={open}
        onClose={() => setOpen(false)}
        items={items}
        label="Buscar en la barbería"
        placeholder="Buscar..."
        emptyLabel="Sin resultados"
        formatResultCount={(count) => `${count} resultados`}
        query={query}
        onQueryChange={setQuery}
      />
    </div>
  );
}

export const ControlledQuery: Story = {
  parameters: { a11y: { test: "todo" } },
  render: () => <ControlledQueryDemo />,
};
