import type { Meta, StoryObj } from "@storybook/react-vite";
import { Bell, Calendar, Scissors, Wallet } from "lucide-react";
import { useState } from "react";
import { Chip } from "../../atoms/chip/chip.js";
import { ItemCardGroup, type ItemCardGroupItem } from "./item-card-group.js";

const items: ItemCardGroupItem[] = [
  {
    id: "corte",
    title: "Corte clásico",
    description: "30 min con Diego Quispe",
    leading: <Scissors aria-hidden="true" />,
    trailing: "S/ 35",
    onSelect: () => {},
  },
  {
    id: "barba",
    title: "Perfilado de barba",
    description: "20 min",
    leading: <Scissors aria-hidden="true" />,
    trailing: "S/ 25",
    onSelect: () => {},
  },
  {
    id: "yape",
    title: "Pagos con Yape",
    description: "Cobra al reservar",
    leading: <Wallet aria-hidden="true" />,
    trailing: <Chip tone="success">Activo</Chip>,
  },
  {
    id: "recordatorios",
    title: "Recordatorios por WhatsApp",
    description: "Se envían 2 horas antes de la cita",
    leading: <Bell aria-hidden="true" />,
    trailing: <Chip tone="neutral">Pausado</Chip>,
    disabled: true,
  },
  {
    id: "agenda",
    title: "Horario de atención",
    description: "Lunes a sábado, 9:00 a 20:00",
    leading: <Calendar aria-hidden="true" />,
    onSelect: () => {},
  },
];

const meta = {
  title: "Containers/ItemCardGroup",
  component: ItemCardGroup,
  tags: ["autodocs"],
  args: {
    title: "Servicios y ajustes",
    description: "Lo que ven tus clientes al reservar",
    items,
  },
  argTypes: {
    title: { control: "text" },
    description: { control: "text" },
    selectedId: { control: "text" },
    items: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ItemCardGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Selectable: Story = {
  render: function Render(args) {
    const [selectedId, setSelectedId] = useState("corte");
    return (
      <ItemCardGroup
        {...args}
        selectedId={selectedId}
        items={args.items.map((item) =>
          item.onSelect ? { ...item, onSelect: () => setSelectedId(item.id) } : item,
        )}
      />
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
};

export const BorderedPreset: Story = {
  decorators: [
    (Story) => (
      <div data-style="bordered" className="bg-bg p-card">
        <Story />
      </div>
    ),
  ],
};

export const BrutalCompact: Story = {
  decorators: [
    (Story) => (
      <div data-style="brutal" data-density="compact" className="bg-bg p-card">
        <Story />
      </div>
    ),
  ],
};
