import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../../atoms/button/index.js";
import { CalendarX, Package } from "../../icons/index.js";
import { EmptyState } from "./empty-state.js";

const meta = {
  title: "States/EmptyState",
  component: EmptyState,
  tags: ["autodocs"],
  args: {
    icon: <CalendarX className="size-8" />,
    title: "Sin citas para hoy",
    description: "Cuando un cliente reserve, su cita aparecerá aquí.",
    action: <Button>Nueva cita</Button>,
  },
  argTypes: {
    title: { control: "text" },
    description: { control: "text" },
    icon: { control: false },
    size: { control: "inline-radio", options: ["md", "sm"] },
    action: { control: false },
  },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const TitleOnly: Story = {
  args: { icon: undefined, description: undefined, action: undefined, title: "Sin resultados" },
};

export const Inventory: Story = {
  args: {
    icon: <Package className="size-8" />,
    title: "Aún no hay productos",
    description: "Registra pomadas, navajas y otros insumos para controlar el stock.",
    action: <Button variant="secondary">Agregar producto</Button>,
  },
};

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="@container w-80 max-w-full">
        <Story />
      </div>
    ),
  ],
};

export const Outlined: Story = { args: { variant: "outlined" } };

export const DomainIcons: Story = {
  render: () => (
    <div className="grid gap-4">
      <EmptyState icon="inbox" title="Nada por aquí" description="Aún no hay registros." />
      <EmptyState icon="search" title="Sin resultados" description="Prueba con otro término." />
      <EmptyState icon="lock" title="Sin acceso" description="Pide permiso a un administrador." />
    </div>
  ),
};

/** Replaces a muted one-line paragraph inside a list or card. */
export const Inline: Story = {
  args: {
    size: "sm",
    icon: "inbox",
    title: "Sin pagos pendientes",
    description: undefined,
    action: undefined,
  },
};

export const InlineWithAction: Story = {
  args: {
    size: "sm",
    icon: "search",
    title: "Sin resultados",
    description: "con esos filtros.",
    action: <Button variant="ghost">Limpiar filtros</Button>,
  },
};
