import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect } from "storybook/test";
import { UiStringsProvider } from "../../i18n/index.js";
import { ShoppingBag, Truck } from "../../icons/index.js";
import { type OrderTicketLine, type OrderTicketLineStatus, splitTicketLines } from "./model.js";
import { OrderTicket } from "./order-ticket.js";

const secondsAgo = (seconds: number) => new Date(Date.now() - seconds * 1000);

const nextStatus: Record<OrderTicketLineStatus, OrderTicketLineStatus> = {
  pending: "in-progress",
  "in-progress": "done",
  done: "pending",
};

const seed: OrderTicketLine[] = [
  { id: "1", qty: 2, name: "Lomo saltado", modifiers: ["Término medio"], status: "in-progress" },
  { id: "2", qty: 1, name: "Ceviche clásico", modifiers: ["Sin cebolla", "Extra limón"] },
  { id: "3", qty: 1, name: "Ají de gallina", allergy: "Maní" },
  { id: "4", qty: 3, name: "Chicha morada", status: "done" },
  { id: "5", qty: 1, name: "Arroz chaufa", note: "Poco picante" },
];

const longOrder: OrderTicketLine[] = [
  ...seed,
  { id: "6", qty: 2, name: "Causa limeña" },
  { id: "7", qty: 1, name: "Anticuchos", modifiers: ["Con papas"] },
  { id: "8", qty: 2, name: "Picarones", note: "Miel aparte" },
  { id: "9", qty: 1, name: "Tacu tacu" },
];

function useLines(initial: readonly OrderTicketLine[]) {
  const [lines, setLines] = useState(initial);
  const toggle = (id: string) =>
    setLines((current) =>
      current.map((line) =>
        line.id === id ? { ...line, status: nextStatus[line.status ?? "pending"] } : line,
      ),
    );
  const setAll = (ids: readonly string[], status: OrderTicketLineStatus) =>
    setLines((current) =>
      current.map((line) => (ids.includes(line.id) ? { ...line, status } : line)),
    );
  return {
    lines: lines.map((line) => ({ ...line, onToggle: () => toggle(line.id) })),
    setAll,
  };
}

function Board({ readOnly = false }: { readOnly?: boolean }) {
  const table = useLines(seed);
  const warn = useLines(seed.slice(0, 3));
  const late = useLines(seed.slice(1, 4));
  const delivery = useLines(seed.slice(2, 5));
  const long = useLines(longOrder);
  const parts = splitTicketLines(long.lines, 7);
  const ids = (lines: readonly OrderTicketLine[]) => lines.map((line) => line.id);
  return (
    <UiStringsProvider locale="es">
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] items-start gap-3 bg-sunken p-3">
        <li>
          <OrderTicket
            table="Mesa 8"
            guests={4}
            server="Rosa"
            since={secondsAgo(4 * 60 + 12)}
            targetMinutes={20}
            lines={table.lines}
            chip="Fondos"
            readOnly={readOnly}
            hanging
            onReadyAll={(lines) => table.setAll(ids(lines), "done")}
          />
        </li>
        <li>
          <OrderTicket
            table="Mesa 3"
            guests={2}
            server="Luis"
            since={secondsAgo(16 * 60 + 40)}
            targetMinutes={20}
            lines={warn.lines}
            chip="Entradas"
            readOnly={readOnly}
            onStartAll={(lines) => warn.setAll(ids(lines), "in-progress")}
          />
        </li>
        <li>
          <OrderTicket
            table="Mesa 12"
            guests={6}
            server="Rosa"
            since={secondsAgo(23 * 60 + 5)}
            targetMinutes={20}
            lines={late.lines}
            chip="Fondos"
            recovered
            readOnly={readOnly}
            onStartAll={(lines) => late.setAll(ids(lines), "in-progress")}
            onReadyAll={(lines) => late.setAll(ids(lines), "done")}
          />
        </li>
        <li>
          <OrderTicket
            number={42}
            channel={{ label: "Delivery", icon: <Truck size={20} aria-hidden="true" /> }}
            customer="Ana"
            since={secondsAgo(6 * 60)}
            targetMinutes={25}
            lines={delivery.lines}
            chip="Cocina caliente"
            readOnly={readOnly}
            onReadyAll={(lines) => delivery.setAll(ids(lines), "done")}
          />
        </li>
        {parts.map((part, index) => (
          <li key={ids(part).join("-")}>
            <OrderTicket
              number={57}
              channel={{ label: "Para llevar", icon: <ShoppingBag size={20} aria-hidden="true" /> }}
              customer="Jorge"
              since={secondsAgo(9 * 60)}
              targetMinutes={30}
              lines={part}
              partIndex={index + 1}
              partCount={parts.length}
              chip="Cocina caliente"
              readOnly={readOnly}
              onReadyAll={(lines) => long.setAll(ids(lines), "done")}
            />
          </li>
        ))}
      </ul>
    </UiStringsProvider>
  );
}

const meta = {
  title: "Containers/OrderTicket",
  component: OrderTicket,
  tags: ["autodocs"],
  args: {
    table: "Mesa 8",
    guests: 4,
    server: "Rosa",
    since: secondsAgo(5 * 60),
    targetMinutes: 20,
    lines: seed,
    chip: "Fondos",
  },
  argTypes: {
    state: { control: "inline-radio", options: ["ok", "warn", "late"] },
    readOnly: { control: "boolean" },
    targetMinutes: { control: { type: "number", min: 1 } },
  },
} satisfies Meta<typeof OrderTicket>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const article = canvasElement.querySelector("article") as HTMLElement;
    await expect(article).toHaveAttribute("data-state", "ok");
    await expect(article.querySelector("h3")).toHaveTextContent(/Mesa 8/);
  },
};

export const Late: Story = {
  args: { since: secondsAgo(24 * 60 + 30) },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("article")).toHaveAttribute("data-state", "late");
    await expect(canvasElement).toHaveTextContent(/Late \+\d+:\d{2}/);
  },
};

export const KitchenBoard: Story = { render: () => <Board /> };

export const WallScreen: Story = {
  render: () => <Board readOnly />,
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("button")).toBeNull();
  },
};
