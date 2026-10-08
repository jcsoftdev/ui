import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../../atoms/button/button.js";
import { Chip } from "../../atoms/chip/chip.js";
import { Toolbar, ToolbarRight } from "./toolbar.js";

const meta = {
  title: "Containers/Toolbar",
  component: Toolbar,
  tags: ["autodocs"],
  args: {
    children: (
      <>
        <Button size="sm" variant="secondary">
          Todos los barberos
        </Button>
        <Button size="sm" variant="ghost">
          Hoy
        </Button>
        <ToolbarRight>
          <Chip tone="neutral">12 citas</Chip>
          <Button size="sm">Nueva cita</Button>
        </ToolbarRight>
      </>
    ),
  },
  argTypes: { children: { control: false } },
} satisfies Meta<typeof Toolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const FiltersOnly: Story = {
  args: {
    children: (
      <>
        <Button size="sm" variant="secondary">
          Categoría: Pomadas
        </Button>
        <Button size="sm" variant="ghost">
          Stock bajo
        </Button>
      </>
    ),
  },
};
