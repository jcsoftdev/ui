import type { Meta, StoryObj } from "@storybook/react-vite";
import { Scissors } from "../../icons/index.js";
import { Button } from "./button.js";

const meta = {
  title: "Atoms/Button",
  component: Button,
  tags: ["autodocs"],
  args: { children: "Reservar corte", variant: "primary", size: "md" },
  argTypes: {
    variant: { control: "inline-radio", options: ["primary", "secondary", "ghost", "danger"] },
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
    loading: { control: "boolean" },
    loadingLabel: { control: "text" },
    block: { control: "boolean" },
    disabled: { control: "boolean" },
    asChild: { control: false },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Secondary: Story = { args: { variant: "secondary", children: "Ver agenda" } };

export const Ghost: Story = { args: { variant: "ghost", children: "Cancelar" } };

export const Danger: Story = { args: { variant: "danger", children: "Anular cita" } };

export const Small: Story = { args: { size: "sm", children: "Cobrar S/ 35" } };

export const Loading: Story = { args: { loading: true, children: "Guardando cliente" } };

export const Large: Story = { args: { size: "lg", children: "Cobrar S/ 35" } };

export const Block: Story = {
  args: { block: true, size: "lg", children: "Confirmar reserva" },
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
};

export const LoadingWithLabel: Story = {
  args: { loading: true, loadingLabel: "Guardando…", children: "Guardar cliente" },
};

export const Disabled: Story = { args: { disabled: true, children: "Cobrar" } };

export const WithIcon: Story = {
  args: {
    children: (
      <>
        <Scissors aria-hidden /> Corte clásico - S/ 25
      </>
    ),
  },
};

export const AsLink: Story = {
  args: {
    asChild: true,
    variant: "secondary",
    children: <a href="#barberos">Ver barberos</a>,
  },
};

/** A long label in a narrow container ends in "…" instead of overflowing; the icon keeps its size. */
export const LongLabel: Story = {
  args: {
    variant: "primary",
    children: (
      <>
        <Scissors aria-hidden /> Confirmar la reserva de corte y barba con Diego
      </>
    ),
  },
  decorators: [
    (Story) => (
      <div style={{ width: 200 }}>
        <Story />
      </div>
    ),
  ],
};
