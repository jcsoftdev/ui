import type { Meta, StoryObj } from "@storybook/react-vite";
import { Scissors } from "lucide-react";
import { Button } from "./button.js";

const meta = {
  title: "Atoms/Button",
  component: Button,
  tags: ["autodocs"],
  args: { children: "Reservar corte", variant: "primary", size: "md" },
  argTypes: {
    variant: { control: "inline-radio", options: ["primary", "secondary", "ghost", "danger"] },
    size: { control: "inline-radio", options: ["sm", "md"] },
    loading: { control: "boolean" },
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
