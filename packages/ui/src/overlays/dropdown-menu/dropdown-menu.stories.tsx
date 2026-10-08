import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "../../atoms/button/button.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu.js";

const meta = {
  title: "Overlays/DropdownMenu",
  component: DropdownMenuContent,
  tags: ["autodocs"],
  args: { align: "start", side: "bottom", sideOffset: 6 },
  argTypes: {
    align: { control: "inline-radio", options: ["start", "center", "end"] },
    side: { control: "inline-radio", options: ["top", "right", "bottom", "left"] },
    sideOffset: { control: "number" },
    children: { control: false },
  },
  parameters: { layout: "centered" },
} satisfies Meta<typeof DropdownMenuContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary">Acciones de la cita</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent {...args}>
        <DropdownMenuLabel>Luis Ramírez · 11:30</DropdownMenuLabel>
        <DropdownMenuItem>Reprogramar</DropdownMenuItem>
        <DropdownMenuItem>Cobrar S/ 45</DropdownMenuItem>
        <DropdownMenuItem disabled>Enviar recordatorio</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-danger">Anular cita</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

export const OpenByDefault: Story = {
  render: (args) => (
    <DropdownMenu defaultOpen modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary">Acciones de la cita</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent {...args}>
        <DropdownMenuLabel>Luis Ramírez · 11:30</DropdownMenuLabel>
        <DropdownMenuItem>Reprogramar</DropdownMenuItem>
        <DropdownMenuItem>Cobrar S/ 45</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-danger">Anular cita</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

export const RadioFilter: Story = {
  render: (args) => {
    const [barber, setBarber] = useState("todos");
    return (
      <DropdownMenu defaultOpen modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary">Barbero: {barber}</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent {...args}>
          <DropdownMenuLabel>Filtrar por barbero</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={barber} onValueChange={setBarber}>
            <DropdownMenuRadioItem value="todos">Todos</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="diego">Diego Quispe</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="mateo">Mateo Flores</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="camila">Camila Rojas</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  },
};
