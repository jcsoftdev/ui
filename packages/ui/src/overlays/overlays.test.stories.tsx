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
    const inside = () => dialog.contains(document.activeElement);
    for (let i = 0; i < 6; i++) {
      await userEvent.tab();
      await expect(inside()).toBe(true);
    }
    for (let i = 0; i < 6; i++) {
      await userEvent.tab({ shift: true });
      await expect(inside()).toBe(true);
    }
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};
