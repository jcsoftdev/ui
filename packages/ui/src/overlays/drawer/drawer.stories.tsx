import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "../../atoms/button/button.js";
import { Chip } from "../../atoms/chip/chip.js";
import { DescriptionList } from "../../containers/description-list/description-list.js";
import { Drawer, DrawerClose, DrawerContent, DrawerTitle, DrawerTrigger } from "./drawer.js";

function AppointmentDetail() {
  return (
    <div className="flex flex-col gap-4 p-5">
      <DrawerTitle className="m-0 pr-8 font-semibold text-[16px]">Detalle de la cita</DrawerTitle>
      <Chip tone="success">Confirmada</Chip>
      <DescriptionList>
        <dt>Cliente</dt>
        <dd>Luis Ramírez</dd>
        <dt>Servicio</dt>
        <dd>Corte + barba</dd>
        <dt>Barbero</dt>
        <dd>Diego Quispe</dd>
        <dt>Hora</dt>
        <dd>Sábado 11:30</dd>
        <dt>Total</dt>
        <dd>S/ 45</dd>
      </DescriptionList>
      <div className="flex gap-2">
        <DrawerClose asChild>
          <Button variant="ghost">Cerrar</Button>
        </DrawerClose>
        <Button className="ml-auto">Iniciar servicio</Button>
      </div>
    </div>
  );
}

const meta = {
  title: "Overlays/Drawer",
  component: DrawerContent,
  tags: ["autodocs"],
  args: { blocking: false, closeLabel: "Cerrar" },
  argTypes: {
    blocking: { control: "boolean" },
    side: { control: "inline-radio", options: ["right", "bottom"] },
    handle: { control: "boolean" },
    closeLabel: { control: "text" },
    children: { control: false },
  },
  parameters: { layout: "centered" },
} satisfies Meta<typeof DrawerContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="secondary">Ver cita</Button>
      </DrawerTrigger>
      <DrawerContent {...args}>
        <AppointmentDetail />
      </DrawerContent>
    </Drawer>
  ),
};

export const OpenByDefault: Story = {
  render: (args) => (
    <Drawer defaultOpen>
      <DrawerContent {...args}>
        <AppointmentDetail />
      </DrawerContent>
    </Drawer>
  ),
};

/** Open on load with the trigger, title and close button all on screen. */
export const WithTriggerOpen: Story = {
  render: (args) => (
    <Drawer defaultOpen>
      <DrawerTrigger asChild>
        <Button variant="secondary">Ver cita</Button>
      </DrawerTrigger>
      <DrawerContent {...args}>
        <AppointmentDetail />
      </DrawerContent>
    </Drawer>
  ),
};

/** `side="bottom"`: a sheet across the width with the safe-area inset, a grab handle and its own scroll. */
export const BottomSheet: Story = {
  args: { side: "bottom", handle: true },
  render: (args) => (
    <Drawer defaultOpen>
      <DrawerTrigger asChild>
        <Button variant="secondary">Ver cita</Button>
      </DrawerTrigger>
      <DrawerContent {...args}>
        <AppointmentDetail />
      </DrawerContent>
    </Drawer>
  ),
};

export const Blocking: Story = {
  args: { blocking: true },
  render: (args) => (
    <Drawer defaultOpen>
      <DrawerContent {...args}>
        <div className="flex flex-col gap-4 p-5">
          <DrawerTitle className="m-0 font-semibold text-[16px]">Guardando cambios</DrawerTitle>
          <p className="m-0 text-[13px] text-ink-2">
            Actualizando el horario de Mateo Flores. Escape y clic fuera están desactivados.
          </p>
          <Button loading>Guardando</Button>
        </div>
      </DrawerContent>
    </Drawer>
  ),
};

export const Controlled: Story = {
  render: (args) => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Abrir con estado externo</Button>
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent {...args}>
            <AppointmentDetail />
          </DrawerContent>
        </Drawer>
      </>
    );
  },
};
