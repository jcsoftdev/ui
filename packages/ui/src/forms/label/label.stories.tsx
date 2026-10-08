import type { Meta, StoryObj } from "@storybook/react-vite";
import { Label } from "./label.js";

const meta = {
  title: "Forms/Label",
  component: Label,
  tags: ["autodocs"],
  args: { children: "Nombre del cliente", htmlFor: "cliente" },
  argTypes: {
    children: { control: "text" },
    htmlFor: { control: "text" },
  },
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Servicio: Story = { args: { children: "Servicio", htmlFor: "servicio" } };
