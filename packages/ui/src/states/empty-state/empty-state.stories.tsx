import type { Meta, StoryObj } from "@storybook/react-vite";
import { CalendarX, Package } from "lucide-react";
import { Button } from "../../atoms/button/index.js";
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
