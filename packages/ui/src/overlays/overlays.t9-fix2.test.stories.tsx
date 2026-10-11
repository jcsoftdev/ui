import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import { Button } from "../atoms/button/button.js";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
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
import { Toaster, toast } from "./toaster/index.js";

const meta = {
  title: "Tests/Overlays/Dialog primitives (review 2)",
  tags: ["!autodocs"],
  parameters: { layout: "centered" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const dialogs = () => screen.queryAllByRole("dialog");

/** Everything from the canvas up to <html> plus body's direct children that is hidden from the page. */
function hiddenAncestors(canvas: HTMLElement): Element[] {
  const found: Element[] = [];
  for (let node: Element | null = canvas; node; node = node.parentElement) {
    if (node.getAttribute("aria-hidden") === "true" || node.hasAttribute("inert")) found.push(node);
  }
  for (const child of Array.from(document.body.children)) {
    if (child.hasAttribute("inert")) found.push(child);
  }
  return found;
}

function MenuOpensDialog({ animate }: { animate: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div id="app-root">
      <style>
        {animate
          ? "@keyframes t9-menu-out { to { opacity: 0; } } [role=menu][data-state=closed] { animation: t9-menu-out 300ms forwards; }"
          : "[role=menu] { animation: none !important; }"}
      </style>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button>Acciones</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => setOpen(true)}>Abrir dialogo</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Controlado</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}

async function menuOpensDialogFlow(canvasElement: HTMLElement) {
  const before = hiddenAncestors(canvasElement);
  await userEvent.click(within(canvasElement).getByRole("button", { name: "Acciones" }));
  await userEvent.click(await screen.findByRole("menuitem", { name: "Abrir dialogo" }));
  await screen.findByRole("dialog", { name: "Controlado" });
  await pause(450);
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(dialogs()).toHaveLength(0));
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  await pause(100);
  await expect(hiddenAncestors(canvasElement)).toEqual(before);
}

export const MenuItemOpensDialogReleasesPageWithExitAnimation: Story = {
  render: () => <MenuOpensDialog animate />,
  play: ({ canvasElement }) => menuOpensDialogFlow(canvasElement),
};

export const MenuItemOpensDialogReleasesPageWithoutExitAnimation: Story = {
  render: () => <MenuOpensDialog animate={false} />,
  play: ({ canvasElement }) => menuOpensDialogFlow(canvasElement),
};

function MenuInDialog({ keepFocus }: { keepFocus: boolean }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Abrir</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Con menu</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>Acciones</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              onCloseAutoFocus={keepFocus ? (event) => event.preventDefault() : undefined}
            >
              <DropdownMenuItem>Reprogramar</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

async function selectItemThenEscape(canvasElement: HTMLElement) {
  await userEvent.click(within(canvasElement).getByRole("button", { name: "Abrir" }));
  const dialog = await screen.findByRole("dialog", { name: "Con menu" });
  await userEvent.click(within(dialog).getByRole("button", { name: "Acciones" }));
  await userEvent.click(await screen.findByRole("menuitem", { name: "Reprogramar" }));
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  await pause(100);
  await expect(dialog.contains(document.activeElement)).toBe(true);
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(dialogs()).toHaveLength(0));
}

export const EscapeClosesDialogAfterMenuSelectWithPreventedFocusReturn: Story = {
  render: () => <MenuInDialog keepFocus />,
  play: ({ canvasElement }) => selectItemThenEscape(canvasElement),
};

export const EscapeClosesDialogAfterMenuSelect: Story = {
  render: () => <MenuInDialog keepFocus={false} />,
  play: ({ canvasElement }) => selectItemThenEscape(canvasElement),
};

function ScrollPage() {
  return (
    <div>
      <div
        data-testid="hscroll"
        style={{ width: 100, overflowX: "auto", overflowY: "hidden", whiteSpace: "nowrap" }}
      >
        <div style={{ width: 400, height: 20 }}>wide</div>
      </div>
      <input data-testid="range" type="range" aria-label="Rango" />
      <div data-testid="plain" style={{ height: 40 }}>
        plain
      </div>
      <Dialog>
        <DialogTrigger asChild>
          <Button>Abrir</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bloqueo</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function drag(target: Element, from: [number, number], to: [number, number]): boolean {
  const make = (type: string, point: [number, number]) => {
    const touch = new Touch({
      identifier: 1,
      target,
      clientX: point[0],
      clientY: point[1],
    });
    return new TouchEvent(type, {
      bubbles: true,
      cancelable: true,
      touches: [touch],
      targetTouches: [touch],
      changedTouches: [touch],
    });
  };
  target.dispatchEvent(make("touchstart", from));
  const move = make("touchmove", to);
  target.dispatchEvent(move);
  return move.defaultPrevented;
}

export const ScrollLockTouchAllowsHorizontalScrollersAndRange: Story = {
  render: () => <ScrollPage />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Abrir" }));
    await screen.findByRole("dialog");
    const find = (id: string) => canvasElement.querySelector(`[data-testid=${id}]`) as Element;
    // Scrolls right: content moves left, and the scroller is at its start.
    await expect(drag(find("hscroll"), [100, 100], [60, 100])).toBe(false);
    // Pulling right at the very start has nothing to scroll: falls through to the page and is cancelled.
    await expect(drag(find("hscroll"), [100, 100], [140, 100])).toBe(true);
    await expect(drag(find("range"), [100, 100], [140, 100])).toBe(false);
    await expect(drag(find("plain"), [100, 100], [100, 60])).toBe(true);
  },
};

function Described({ optOut }: { optOut?: boolean }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Abrir</Button>
      </DialogTrigger>
      <DialogContent {...(optOut ? { "aria-describedby": undefined } : {})}>
        <DialogHeader>
          <DialogTitle>Con descripcion</DialogTitle>
          <DialogDescription>Detalle de la cita</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <input aria-label="Motivo" />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

export const DialogDescribedAtFirstFocusin: Story = {
  render: () => <Described />,
  play: async ({ canvasElement }) => {
    const seen: boolean[] = [];
    const onFocusIn = (event: FocusEvent) => {
      const dialog = (event.target as Element).closest("[role=dialog]");
      if (!dialog) return;
      const id = dialog.getAttribute("aria-describedby");
      seen.push(Boolean(id && document.getElementById(id)));
    };
    document.addEventListener("focusin", onFocusIn, true);
    try {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Abrir" }));
      await screen.findByRole("dialog", { name: "Con descripcion" });
      await expect(seen.length).toBeGreaterThan(0);
      await expect(seen[0]).toBe(true);
      await expect(screen.getByRole("dialog")).toHaveAccessibleDescription("Detalle de la cita");
    } finally {
      document.removeEventListener("focusin", onFocusIn, true);
    }
  },
};

export const DialogDescribedByCanOptOut: Story = {
  render: () => <Described optOut />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Abrir" }));
    const dialog = await screen.findByRole("dialog");
    await expect(dialog.hasAttribute("aria-describedby")).toBe(false);
  },
};

function ToastWithDialog() {
  return (
    <div>
      <Toaster />
      <Dialog>
        <DialogTrigger asChild>
          <Button>Abrir</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modal</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const EscapeOnFocusedToastDoesNotCloseDialog: Story = {
  render: () => <ToastWithDialog />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Abrir" }));
    await screen.findByRole("dialog");
    toast("Cita anulada", {
      duration: Number.POSITIVE_INFINITY,
      action: { label: "Deshacer", onClick: () => {} },
    });
    const action = await screen.findByRole("button", { name: "Deshacer" });
    action.focus();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByText("Cita anulada")).toBeNull());
    await expect(dialogs()).toHaveLength(1);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(dialogs()).toHaveLength(0));
  },
};

function LiveOffPage() {
  return (
    <div>
      <p aria-live="off" data-testid="live-off">
        Contador
      </p>
      <p aria-live="polite" data-testid="live-polite">
        Estado
      </p>
      <div role="listbox" aria-label="Lista de fondo" data-testid="listbox" />
      <Dialog>
        <DialogTrigger asChild>
          <Button>Abrir</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modal</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const LiveRegionOffIsHiddenAndClosedListboxDoesNotSwallowEscape: Story = {
  render: () => <LiveOffPage />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Abrir" }));
    await screen.findByRole("dialog");
    const find = (id: string) => canvasElement.querySelector(`[data-testid=${id}]`) as HTMLElement;
    await expect(find("live-off").closest("[aria-hidden=true]")).not.toBeNull();
    await expect(find("live-polite").closest("[aria-hidden=true]")).toBeNull();
    find("listbox").dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    );
    await waitFor(() => expect(dialogs()).toHaveLength(0));
  },
};

function ToasterInContainer() {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  return (
    <div>
      <div ref={setContainer} data-testid="themed" dir="rtl" />
      <Toaster container={container} />
    </div>
  );
}

export const ToasterPortalsIntoContainerAndCopiesDir: Story = {
  render: () => <ToasterInContainer />,
  play: async ({ canvasElement }) => {
    toast("Dentro del contenedor", { duration: Number.POSITIVE_INFINITY });
    const message = await screen.findByText("Dentro del contenedor");
    const themed = canvasElement.querySelector("[data-testid=themed]") as HTMLElement;
    await expect(themed.contains(message)).toBe(true);
    toast.dismiss();
  },
};

export const ToasterCopiesDocumentDir: Story = {
  render: () => <Toaster />,
  beforeEach: () => {
    const previous = document.documentElement.getAttribute("dir");
    document.documentElement.setAttribute("dir", "rtl");
    return () => {
      if (previous === null) document.documentElement.removeAttribute("dir");
      else document.documentElement.setAttribute("dir", previous);
    };
  },
  play: async () => {
    const region = await screen.findByRole("region", { name: /./ });
    await expect(region).toHaveAttribute("dir", "rtl");
  },
};
