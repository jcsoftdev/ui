import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "../../atoms/button/button.js";
import { Chip } from "../../atoms/chip/chip.js";
import { ResponsiveList, type ResponsiveListColumn } from "./responsive-list.js";

interface Order {
  id: string;
  customer: string;
  total: string;
  status: "paid" | "pending";
  time: string;
}

const orders: Order[] = [
  { id: "A-101", customer: "Marco Salazar", total: "S/ 45.00", status: "paid", time: "12:30" },
  { id: "A-102", customer: "Lucía Paredes", total: "S/ 80.50", status: "pending", time: "12:45" },
  { id: "A-103", customer: "Diego Quispe", total: "S/ 25.00", status: "paid", time: "13:10" },
];

const columns: ResponsiveListColumn<Order>[] = [
  { key: "customer", header: "Cliente", cell: (o) => o.customer, primary: true },
  { key: "time", header: "Hora", cell: (o) => o.time },
  {
    key: "status",
    header: "Estado",
    cell: (o) => (
      <Chip tone={o.status === "paid" ? "success" : "warning"} statusIcon>
        {o.status === "paid" ? "Pagado" : "Por pagar"}
      </Chip>
    ),
  },
  { key: "total", header: "Total", cell: (o) => o.total, align: "end" },
];

const meta = {
  title: "Containers/ResponsiveList",
  component: ResponsiveList<Order>,
  tags: ["autodocs"],
  args: {
    caption: "Pedidos de hoy",
    items: orders,
    columns,
    rowKey: (o: Order) => o.id,
  },
  argTypes: {
    items: { control: false },
    columns: { control: false },
    rowKey: { control: false },
    renderActions: { control: false },
    rowClassName: { control: false },
  },
} satisfies Meta<typeof ResponsiveList<Order>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithActions: Story = {
  args: {
    renderActions: (o: Order) => <Button size="sm">Ver {o.id}</Button>,
  },
};

/** `onSelect` makes rows selectable: listbox cards and a grid of rows, arrows move focus, Enter or Space selects. */
export const Selectable: Story = {
  render: (args) => {
    const [key, setKey] = useState<string | null>("A-102");
    return <ResponsiveList {...args} selectedKey={key} onSelect={setKey} />;
  },
};

/** Arrow keys select the row they land on, as a master list next to its detail does. */
export const SelectOnFocus: Story = {
  render: (args) => {
    const [key, setKey] = useState<string | null>("A-101");
    return (
      <ResponsiveList {...args} layout="cards" selectedKey={key} onSelect={setKey} selectOnFocus />
    );
  },
};

export const HighlightedRow: Story = {
  args: {
    rowClassName: (o: Order) => (o.status === "pending" ? "bg-warning-soft" : undefined),
  },
};

/** Under the container breakpoint (672 px, 42rem, by default) the same data renders as stacked cards. */
export const Phone: Story = {
  args: { renderActions: (o: Order) => <Button size="sm">Ver {o.id}</Button> },
  decorators: [
    (Story) => (
      <div className="w-[360px] max-w-full">
        <Story />
      </div>
    ),
  ],
};

/** The switch follows the list's own width: a narrow pane on a wide screen still gets cards. */
export const NarrowPane: Story = {
  decorators: [
    (Story) => (
      <div className="w-[520px] max-w-full">
        <Story />
      </div>
    ),
  ],
};

export const EarlierBreakpoint: Story = {
  args: { breakpoint: 480 },
  decorators: NarrowPane.decorators,
};

/** Labels stay in the accessibility tree and leave the card. */
export const HiddenCardLabels: Story = {
  args: { layout: "cards", cardLabels: "hidden" },
};
