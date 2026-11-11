import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, screen, userEvent, waitFor } from "storybook/test";
import { IconButton } from "../../atoms/icon-button/icon-button.js";
import { Calendar, Package, Scissors, Sparkles, UserRound } from "../../icons/index.js";
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
  render: () => <ControlledQueryDemo />,
};

export const TypeSelectAndClose: Story = {
  args: { onClose: fn() },
  play: async ({ args }) => {
    const box = await screen.findByRole("combobox");
    await userEvent.type(box, "pomada");
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(1));
    await expect(screen.getByText("1 resultados")).toBeInTheDocument();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(items[4]?.onSelect).toHaveBeenCalled());
    await expect(args.onClose).toHaveBeenCalled();
  },
};

export const EscapeCloses: Story = {
  args: { onClose: fn() },
  play: async ({ args }) => {
    await screen.findByRole("combobox");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(args.onClose).toHaveBeenCalled());
  },
};

function SubmitQueryDemo({
  onSubmitQuery,
  onClose,
}: {
  onSubmitQuery: (query: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  return (
    <CommandPalette
      open
      onClose={onClose}
      items={items}
      label="Buscar en la barbería"
      placeholder="Buscar o pedir..."
      emptyLabel="Sin resultados"
      formatResultCount={(count) => `${count} resultados`}
      query={query}
      onQueryChange={setQuery}
      onSubmitQuery={(submitted) => {
        onSubmitQuery(submitted);
        setQuery("");
      }}
    />
  );
}

export const SubmitQuery: Story = {
  args: { onClose: fn(), onSubmitQuery: fn() },
  render: (args) => (
    <SubmitQueryDemo
      onSubmitQuery={args.onSubmitQuery ?? (() => undefined)}
      onClose={args.onClose}
    />
  ),
  play: async ({ args }) => {
    const box = await screen.findByRole("combobox");
    await userEvent.type(box, "pedido para la mesa 3");
    await waitFor(() => expect(screen.queryAllByRole("option")).toHaveLength(0));
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(args.onSubmitQuery).toHaveBeenCalledWith("pedido para la mesa 3"));
    await expect(args.onClose).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getAllByRole("option").length).toBeGreaterThan(0));
  },
};

export const InputEnd: Story = {
  args: {
    inputEnd: (
      <IconButton label="Dictar">
        <Sparkles />
      </IconButton>
    ),
  },
  play: async () => {
    const box = await screen.findByRole("combobox");
    await userEvent.click(box);
    await userEvent.tab();
    await expect(screen.getByRole("button", { name: "Dictar" })).toHaveFocus();
  },
};

export const KeepOpen: Story = {
  args: { onClose: fn(), keepOpenOnSelect: true },
  play: async ({ args }) => {
    const box = await screen.findByRole("combobox");
    await userEvent.type(box, "pomada");
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(1));
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(items[4]?.onSelect).toHaveBeenCalled());
    await expect(args.onClose).not.toHaveBeenCalled();
  },
};
