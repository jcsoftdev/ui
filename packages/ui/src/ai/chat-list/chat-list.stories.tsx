import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { ChatList, type ChatListItem } from "./chat-list.js";

const NOW = new Date(2026, 5, 20, 12, 0);
const ago = (days: number, hour = 9) => new Date(2026, 5, 20 - days, hour, 0);

const ITEMS: ChatListItem[] = [
  {
    id: "1",
    title: "Turnos libres del sábado",
    updatedAt: ago(0, 10),
    preview: "Tienes tres huecos con Diego…",
    unread: true,
  },
  {
    id: "2",
    title: "Resumen de ingresos",
    updatedAt: ago(0, 8),
    preview: "La semana cerró en S/ 4 820.",
  },
  {
    id: "3",
    title: "Recordatorio a clientes",
    updatedAt: ago(1),
    preview: "Listo, envié 12 mensajes.",
  },
  { id: "4", title: "Inventario de cera", updatedAt: ago(4), preview: "Quedan 3 unidades." },
  {
    id: "5",
    title: "Promoción de Fiestas Patrias",
    updatedAt: ago(18),
    preview: "Propuesta de combo corte + barba.",
  },
  {
    id: "6",
    title: "Horarios de feriados",
    updatedAt: ago(75),
    preview: "Cerramos el 28 y 29 de julio.",
  },
];

const meta = {
  title: "AI/ChatList",
  component: ChatList,
  tags: ["autodocs"],
  args: {
    items: ITEMS,
    activeId: "2",
    now: NOW,
    onNew: () => {},
    onSelect: () => {},
    onDelete: () => {},
  },
  argTypes: {
    activeId: { control: "text" },
    label: { control: "text" },
    emptyText: { control: "text" },
    items: { control: "object" },
    now: { control: false },
    onNew: { control: false },
    onSelect: { control: false },
    onDelete: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ChatList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Interactive: Story = {
  render: (args) => {
    const [items, setItems] = useState(ITEMS);
    const [active, setActive] = useState("1");
    return (
      <ChatList
        {...args}
        items={items}
        activeId={active}
        onSelect={setActive}
        onDelete={(id) => setItems((list) => list.filter((item) => item.id !== id))}
      />
    );
  },
};

export const Empty: Story = { args: { items: [] } };

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="w-[200px]">
        <Story />
      </div>
    ),
  ],
};

export const PresetBrutal: Story = {
  decorators: [
    (Story) => (
      <div data-style="brutal" className="w-72 bg-bg p-card">
        <Story />
      </div>
    ),
  ],
};
