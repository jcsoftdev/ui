import type { Meta, StoryObj } from "@storybook/react-vite";
import { HighlightLine } from "./highlight-line.js";

const meta = {
  title: "Containers/HighlightLine",
  component: HighlightLine,
  tags: ["autodocs"],
  args: {
    children: (
      <>
        Hoy llevas <strong>S/ 840</strong> en ingresos, 12% más que el sábado pasado.
      </>
    ),
  },
  argTypes: { children: { control: false } },
} satisfies Meta<typeof HighlightLine>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const PlainText: Story = {
  args: { children: "Aún no hay citas registradas para esta tarde." },
};
