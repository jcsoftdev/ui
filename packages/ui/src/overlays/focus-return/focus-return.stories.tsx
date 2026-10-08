import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "../../atoms/button/button.js";
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "../dialog/dialog.js";
import { useCapturePreviousFocus } from "./focus-return.js";

/**
 * Hook demo: `useCapturePreviousFocus` is what lets a controlled `Dialog`
 * (no `DialogTrigger`) hand focus back to the button that opened it.
 */
function FocusReturnDemo({ initialOpen }: { initialOpen: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  const captured = useCapturePreviousFocus(open);
  return (
    <div className="flex flex-col items-start gap-3">
      <Button onClick={() => setOpen(true)}>Editar horario de Diego</Button>
      <p className="m-0 max-w-sm text-[12px] text-ink-3">
        Cierra el diálogo con Escape: el foco vuelve a este botón aunque el diálogo no tenga su
        propio trigger.
        {captured.current ? " (foco previo capturado)" : ""}
      </p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent closeLabel="Cerrar">
          <DialogHeader>
            <DialogTitle>Horario de Diego Quispe</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="m-0 text-[13px] text-ink-2">Lunes a sábado, 10:00 a 19:00.</p>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const meta = {
  title: "Overlays/FocusReturn",
  component: FocusReturnDemo,
  tags: ["autodocs"],
  args: { initialOpen: false },
  argTypes: { initialOpen: { control: "boolean" } },
  parameters: { layout: "centered" },
} satisfies Meta<typeof FocusReturnDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const OpenByDefault: Story = { args: { initialOpen: true } };
