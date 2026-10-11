import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { CalendarClock, Copy, Pencil, Trash2 } from "../../icons/index.js";
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  type ContextMenuProps,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "./context-menu.js";

const meta = {
  title: "Overlays/ContextMenu",
  component: ContextMenu,
  tags: ["autodocs"],
  args: { children: null },
  argTypes: { children: { control: false }, onOpenChange: { control: false } },
} satisfies Meta<typeof ContextMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

function Area({
  container,
  menu,
}: {
  container?: HTMLElement | null;
  menu?: Pick<ContextMenuProps, "defaultOpen" | "position">;
}) {
  const [confirmada, setConfirmada] = useState(true);
  const [last, setLast] = useState("ninguna");
  const pick = (action: string) => () => setLast(action);
  return (
    <ContextMenu {...menu}>
      <ContextMenuTrigger
        tabIndex={0}
        aria-label="Cita de Luis Ramírez. Clic derecho o tecla Menú para ver acciones"
        className="flex min-h-32 w-full min-w-0 flex-col justify-between gap-density rounded-card border-card surface-card p-card shadow-card focus-visible:focus-ring"
      >
        <div>
          <h3 className="m-0 text-card-title text-ink">Luis Ramírez, 16:00</h3>
          <p className="m-0 text-ink-3 text-meta">Corte clásico con Diego Quispe, S/ 35</p>
        </div>
        <p className="m-0 text-ink-3 text-meta">
          Clic derecho (o mantén presionado / tecla Menú). Última acción: {last}
        </p>
      </ContextMenuTrigger>
      <ContextMenuContent container={container} aria-label="Acciones de la cita">
        <ContextMenuLabel>Cita</ContextMenuLabel>
        <ContextMenuItem onSelect={pick("editar")}>
          <Pencil aria-hidden="true" /> Editar
          <ContextMenuShortcut>E</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onSelect={pick("reprogramar")}>
          <CalendarClock aria-hidden="true" /> Reprogramar
        </ContextMenuItem>
        <ContextMenuItem onSelect={pick("duplicar")}>
          <Copy aria-hidden="true" /> Duplicar
          <ContextMenuShortcut>Ctrl+D</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuCheckboxItem checked={confirmada} onCheckedChange={setConfirmada}>
          Confirmada
        </ContextMenuCheckboxItem>
        <ContextMenuSeparator />
        <ContextMenuItem tone="danger" onSelect={pick("cancelar")}>
          <Trash2 aria-hidden="true" /> Cancelar cita
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export const Default: Story = {
  render: () => (
    <div className="w-full max-w-md">
      <Area />
    </div>
  ),
};

export const Narrow: Story = {
  render: () => (
    <div className="w-[320px] max-w-full">
      <Area />
    </div>
  ),
};

/** The menu renders in a portal, so a scoped preset needs the portal inside the scoped element. */
export const BrutalPreset: Story = {
  render: function Render() {
    const [scope, setScope] = useState<HTMLElement | null>(null);
    return (
      <div ref={setScope} data-style="brutal" className="w-full max-w-md bg-bg p-card">
        <Area container={scope} />
      </div>
    );
  },
};

/** Open on load at a fixed point: label, items, shortcuts, checkbox, separator and danger item are all visible. */
export const OpenByDefault: Story = {
  render: () => (
    <div className="h-96 w-full max-w-md">
      <Area menu={{ defaultOpen: true, position: { x: 120, y: 140 } }} />
    </div>
  ),
};
