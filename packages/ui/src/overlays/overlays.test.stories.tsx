import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import { Button } from "../atoms/button/button.js";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog/dialog.js";

const meta = {
  title: "Tests/Overlays",
  tags: ["!autodocs"],
  parameters: { layout: "centered" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const DialogFocusAndEscape: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Abrir</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Anular cita</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <input aria-label="Motivo" />
          <button type="button">Confirmar</button>
        </DialogBody>
      </DialogContent>
    </Dialog>
  ),
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", { name: "Abrir" });
    await userEvent.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "Anular cita" });
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    const label = () =>
      document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.textContent;
    const forward = ["Confirmar", "Close", "Motivo", "Confirmar"];
    const seen: Array<string | null | undefined> = [];
    for (let i = 0; i < forward.length; i++) {
      await userEvent.tab();
      seen.push(label());
    }
    await expect(dialog.contains(document.activeElement)).toBe(true);
    await expect(seen).toEqual(forward);
    const backward: Array<string | null | undefined> = [];
    for (let i = 0; i < 3; i++) {
      await userEvent.tab({ shift: true });
      backward.push(label());
    }
    await expect(backward).toEqual(["Motivo", "Close", "Confirmar"]);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};
