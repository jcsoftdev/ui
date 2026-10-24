import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, screen, waitFor } from "storybook/test";
import { Button } from "../../atoms/button/button.js";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog.js";

function CancelBody() {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Anular cita</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <p className="m-0 text-[13px] text-ink-2">
          Vas a anular la cita de Luis Ramírez (Corte + barba, sábado 11:30 con Diego Quispe). El
          horario quedará libre.
        </p>
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="ghost">Volver</Button>
        </DialogClose>
        <DialogClose asChild>
          <Button variant="danger" className="ml-auto">
            Anular cita
          </Button>
        </DialogClose>
      </DialogFooter>
    </>
  );
}

const meta = {
  title: "Overlays/Dialog",
  component: DialogContent,
  tags: ["autodocs"],
  args: { width: "md", blocking: false, closeLabel: "Cerrar" },
  argTypes: {
    width: { control: "inline-radio", options: ["md", "lg"] },
    blocking: { control: "boolean" },
    closeLabel: { control: "text" },
    children: { control: false },
  },
  parameters: { layout: "centered" },
} satisfies Meta<typeof DialogContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="danger">Anular cita</Button>
      </DialogTrigger>
      <DialogContent {...args}>
        <CancelBody />
      </DialogContent>
    </Dialog>
  ),
};

export const OpenByDefault: Story = {
  render: (args) => (
    <Dialog defaultOpen>
      <DialogContent {...args}>
        <CancelBody />
      </DialogContent>
    </Dialog>
  ),
};

/** The close button is a 30px hit area, and its glyph sits 24px from the top and right edges as before. */
export const CloseHitArea: Story = {
  render: (args) => (
    <Dialog defaultOpen>
      <DialogContent {...args}>
        <CancelBody />
      </DialogContent>
    </Dialog>
  ),
  play: async () => {
    const close = await screen.findByRole("button", { name: "Cerrar" });
    // Measure once the enter transition (a scale) has settled.
    await waitFor(() =>
      expect(getComputedStyle(screen.getByRole("dialog")).scale).toMatch(/^(none|1)$/),
    );
    const box = close.getBoundingClientRect();
    await expect(Math.round(box.width)).toBe(30);
    await expect(Math.round(box.height)).toBe(30);
    const dialog = screen.getByRole("dialog").getBoundingClientRect();
    const glyph = close.querySelector("svg")?.getBoundingClientRect();
    await expect(glyph).toBeDefined();
    if (!glyph) return;
    await expect(Math.round(glyph.top + glyph.height / 2 - dialog.top)).toBe(24);
    await expect(Math.round(dialog.right - (glyph.left + glyph.width / 2))).toBe(24);
  },
};

export const Large: Story = {
  args: { width: "lg" },
  render: (args) => (
    <Dialog defaultOpen>
      <DialogContent {...args}>
        <DialogHeader>
          <DialogTitle>Nueva cita</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p className="m-0 text-[13px] text-ink-2">
            Cliente: Marco Salas · Servicio: Corte clásico (30 min, S/ 25) · Barbero: Mateo Flores.
          </p>
          <p className="m-0 text-[13px] text-ink-3">Horario sugerido: sábado 12:00.</p>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancelar</Button>
          </DialogClose>
          <Button className="ml-auto">Agendar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const Blocking: Story = {
  args: { blocking: true },
  render: (args) => (
    <Dialog defaultOpen>
      <DialogContent {...args}>
        <DialogHeader>
          <DialogTitle>Registrando pago</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p className="m-0 text-[13px] text-ink-2">
            Procesando S/ 45 con Yape. No cierres esta ventana. Escape y clic fuera están
            desactivados.
          </p>
        </DialogBody>
        <DialogFooter>
          <Button loading className="ml-auto">
            Cobrando
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const Controlled: Story = {
  render: (args) => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Abrir con estado externo</Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent {...args}>
            <CancelBody />
          </DialogContent>
        </Dialog>
      </>
    );
  },
};

/** `container` portals the dialog into a scoped wrapper so its `data-style` reaches it. */
export const InScopedContainer: Story = {
  render: (args) => <ScopedDialog {...args} />,
  parameters: { layout: "padded" },
};

function ScopedDialog(args: React.ComponentProps<typeof DialogContent>) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  return (
    <div ref={setHost} data-style="brutal" className="relative min-h-80 bg-bg p-6">
      <Dialog defaultOpen>
        <DialogContent {...args} container={host}>
          <CancelBody />
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Verified: with `container` set to the element that carries `data-style`, the dialog card reads that
 * preset (under `brutal` its radius is 0, with a 2 px ring and a hard offset shadow; under `soft` 20 px).
 * Pick a preset to see it change; the page outside the wrapper keeps its own style.
 */
export const InScopedPreset: Story = {
  parameters: { layout: "padded" },
  render: (args) => {
    const [host, setHost] = useState<HTMLElement | null>(null);
    const [style, setStyle] = useState("brutal");
    return (
      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-2 text-ink-2 text-meta">
          Preset del contenedor
          <select
            value={style}
            onChange={(event) => setStyle(event.target.value)}
            className="rounded-input border-control bg-surface-control px-2 py-1 text-ink"
          >
            {["soft", "bordered", "elevated", "flat", "glass", "brutal"].map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
        <div ref={setHost} data-style={style} className="relative min-h-80 bg-bg p-6">
          <Dialog defaultOpen>
            <DialogContent {...args} container={host}>
              <CancelBody />
            </DialogContent>
          </Dialog>
        </div>
      </div>
    );
  },
};
