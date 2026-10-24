import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import { Button } from "../atoms/button/button.js";
import { SelectMenu } from "../forms/select-menu/select-menu.js";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog/dialog.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu/dropdown-menu.js";
import { Popover, PopoverContent, PopoverTrigger } from "./popover/popover.js";
import { Tooltip } from "./tooltip/tooltip.js";

function Gallery() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button>Acciones</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Editar</DropdownMenuItem>
          <DropdownMenuItem>Duplicar</DropdownMenuItem>
          <DropdownMenuItem>Archivar</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Popover>
        <PopoverTrigger asChild>
          <Button>Detalles</Button>
        </PopoverTrigger>
        <PopoverContent>
          <p className="m-0 p-2 text-body">Vence el 30 de marzo.</p>
        </PopoverContent>
      </Popover>
      <div className="w-48">
        <SelectMenu
          aria-label="Ciudad"
          defaultValue="lima"
          options={[
            { value: "lima", label: "Lima" },
            { value: "cusco", label: "Cusco" },
          ]}
        />
      </div>
      <Tooltip content="Copiar enlace">
        <Button>Compartir</Button>
      </Tooltip>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="primary">Nueva cita</Button>
        </DialogTrigger>
        <DialogContent closeLabel="Cerrar">
          <DialogHeader>
            <DialogTitle>Nueva cita</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="m-0 text-body">El diálogo entra y sale con un fundido y una escala.</p>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Enter and exit motion of the overlays. Menus, popovers, listboxes, tooltips and hover cards grow
 * from their anchor (`--ui-popper-transform-origin`) and slide a few pixels from its side; dialogs
 * fade and settle from 97%; drawers slide in; the scrim fades. Every exit plays before the node
 * unmounts. Timing follows `--motion-duration` / `--motion-ease`, and reduced motion turns it off.
 */
const meta = {
  title: "Overlays/Motion",
  component: Gallery,
} satisfies Meta<typeof Gallery>;

export default meta;
type Story = StoryObj<typeof meta>;

const seconds = (value: string) => Number.parseFloat(value) * (value.endsWith("ms") ? 0.001 : 1);

export const Default: Story = {};

/** The menu transitions in from its trigger side and stays mounted while it fades out. */
export const MenuEntersAndExits: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Acciones" }));
    const menu = await screen.findByRole("menu");
    const style = getComputedStyle(menu);
    await expect(menu).toHaveAttribute("data-side", "bottom");
    await expect(style.transitionProperty).toContain("opacity");
    await expect(seconds(style.transitionDuration.split(",")[0] ?? "0")).toBeGreaterThan(0);
    await waitFor(() => expect(getComputedStyle(menu).opacity).toBe("1"));
    const item = within(menu).getAllByRole("menuitem")[0];
    await expect(item && getComputedStyle(item).transitionProperty).toContain("background-color");
    await userEvent.keyboard("{Escape}");
    await expect(menu).toHaveAttribute("data-state", "closed");
    await expect(menu.isConnected).toBe(true);
    await waitFor(() => expect(menu.isConnected).toBe(false));
  },
};

/** The dialog and its scrim leave with a fade before they unmount. */
export const DialogEntersAndExits: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Nueva cita" }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(getComputedStyle(dialog).opacity).toBe("1"));
    await expect(getComputedStyle(dialog).transitionProperty).toContain("scale");
    await userEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    await expect(dialog).toHaveAttribute("data-state", "closed");
    await expect(dialog.isConnected).toBe(true);
    await waitFor(() => expect(dialog.isConnected).toBe(false));
  },
};
