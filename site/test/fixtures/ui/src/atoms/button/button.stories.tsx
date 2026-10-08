import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button.js";

const meta = {
  title: "Atoms/Button",
  component: Button,
  args: { label: "Reservar corte", variant: "primary" },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Loading: Story = { args: { loading: true, "aria-label": "Guardando" } };

export const Downsampled100K: Story = { name: "Large series" };

export const WithIcon: Story = { args: { label: "Cobrar S/ 35" } };
