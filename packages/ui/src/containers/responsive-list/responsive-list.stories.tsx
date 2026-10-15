import type { Meta, StoryObj } from "@storybook/react-vite";
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

export const HighlightedRow: Story = {
  args: {
    rowClassName: (o: Order) => (o.status === "pending" ? "bg-warning-soft" : undefined),
  },
};

/** Under 42rem of container width the same data renders as stacked cards. */
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
