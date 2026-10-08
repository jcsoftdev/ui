import type { Meta, StoryObj } from "@storybook/react-vite";
import { ForbiddenState } from "./forbidden-state.js";

const meta = {
  title: "States/ForbiddenState",
  component: ForbiddenState,
  tags: ["autodocs"],
  args: {
    title: "No tienes acceso a los reportes de ingresos",
    reason: "Solo el administrador de la barbería puede ver las ventas del local.",
  },
  argTypes: {
    title: { control: "text" },
    reason: { control: "text" },
  },
} satisfies Meta<typeof ForbiddenState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const TitleOnly: Story = { args: { reason: undefined } };
