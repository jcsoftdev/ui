import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import { Button } from "../atoms/button/button.js";
import { UiStringsProvider } from "../i18n/index.js";
import {
  Dialog,
  DialogBody,
  DialogClose,
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

const SCRIM = ".bg-scrim";
const dialogs = () => screen.queryAllByRole("dialog");

function Simple({
  label = "Abrir",
  title = "Anular cita",
  ...content
}: { label?: string; title?: string } & Record<string, unknown>) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>{label}</Button>
      </DialogTrigger>
      <DialogContent {...content}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <input aria-label="Motivo" />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

export const DialogAriaAndInitialFocus: Story = {
  render: () => <Simple />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Abrir" }));
    const dialog = await screen.findByRole("dialog", { name: "Anular cita" });
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(dialog).toHaveAttribute("data-state", "open");
    await expect(dialog.parentElement).toBe(document.body);
    await waitFor(() => expect(screen.getByLabelText("Motivo")).toHaveFocus());
  },
};

export const DialogOutsideClickCloses: Story = {
  render: () => <Simple />,
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", { name: "Abrir" });
    await userEvent.click(trigger);
    await screen.findByRole("dialog");
    await userEvent.click(document.querySelector(SCRIM) as Element);
    await waitFor(() => expect(dialogs()).toHaveLength(0));
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};

export const DialogPreventDismiss: Story = {
  render: () => (
    <Simple
      onEscapeKeyDown={(event: Event) => event.preventDefault()}
      onPointerDownOutside={(event: Event) => event.preventDefault()}
    />
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Abrir" }));
    await screen.findByRole("dialog");
    await userEvent.keyboard("{Escape}");
    await userEvent.click(document.querySelector(SCRIM) as Element);
    await new Promise((resolve) => setTimeout(resolve, 150));
    await expect(dialogs()).toHaveLength(1);
  },
};

export const DialogBlockingKeepsOpen: Story = {
  render: () => <Simple blocking />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Abrir" }));
    await screen.findByRole("dialog");
    await userEvent.keyboard("{Escape}");
    await userEvent.click(document.querySelector(SCRIM) as Element);
    await new Promise((resolve) => setTimeout(resolve, 150));
    await expect(dialogs()).toHaveLength(1);
  },
};

function Nested() {
  return (
    <div>
      <button type="button">Fondo</button>
      <Dialog>
        <DialogTrigger asChild>
          <Button>Abrir A</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dialogo A</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Dialog>
              <DialogTrigger asChild>
                <Button>Abrir B</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Dialogo B</DialogTitle>
                </DialogHeader>
                <DialogClose asChild>
                  <Button>Cerrar B</Button>
                </DialogClose>
              </DialogContent>
            </Dialog>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const DialogNestedEscapeInertAndScrollLock: Story = {
  render: () => <Nested />,
  play: async ({ canvasElement }) => {
    const body = document.body;
    const before = body.style.overflow;
    await expect(canvasElement.closest("[inert]")).toBeNull();
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Abrir A" }));
    const a = await screen.findByRole("dialog", { name: "Dialogo A" });
    await expect(body.style.overflow).toBe("hidden");
    await expect(canvasElement.closest("[inert]")).not.toBeNull();
    await expect(canvasElement.closest("[aria-hidden=true]")).not.toBeNull();

    await userEvent.click(within(a).getByRole("button", { name: "Abrir B" }));
    const b = await screen.findByRole("dialog", { name: "Dialogo B" });
    await expect(a.closest("[inert]")).not.toBeNull();
    await expect(a).toHaveAttribute("aria-hidden", "true");
    await expect(b.closest("[inert]")).toBeNull();
    await waitFor(() => expect(b.contains(document.activeElement)).toBe(true));

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Dialogo B" })).toBeNull());
    await expect(screen.getByRole("dialog", { name: "Dialogo A" })).toBeInTheDocument();
    await expect(a.closest("[inert]")).toBeNull();
    await expect(body.style.overflow).toBe("hidden");
    await waitFor(() => expect(within(a).getByRole("button", { name: "Abrir B" })).toHaveFocus());

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(dialogs()).toHaveLength(0));
    await expect(body.style.overflow).toBe(before);
    await expect(canvasElement.closest("[inert]")).toBeNull();
    await expect(canvasElement.closest("[aria-hidden=true]")).toBeNull();
  },
};

const MOTION_CSS = `
@keyframes t9-out { from { opacity: 1 } to { opacity: 0 } }
.t9-exit[data-state="closed"] { animation: t9-out 600ms forwards; }
`;

function Animated() {
  return (
    <>
      <style>{MOTION_CSS}</style>
      <Simple className="t9-exit" />
    </>
  );
}

export const DialogExitAnimationKeepsContent: Story = {
  render: () => <Animated />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Abrir" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.keyboard("{Escape}");
    await expect(dialog).toBeInTheDocument();
    await expect(dialog).toHaveAttribute("data-state", "closed");
    await new Promise((resolve) => setTimeout(resolve, 250));
    await expect(dialog).toBeInTheDocument();
    await waitFor(() => expect(dialog).not.toBeInTheDocument(), { timeout: 1500 });
  },
};

export const DialogReducedMotionUnmountsAtOnce: Story = {
  render: () => <Animated />,
  play: async ({ canvasElement }) => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    try {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Abrir" }));
      await screen.findByRole("dialog");
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(dialogs()).toHaveLength(0), { timeout: 200 });
    } finally {
      window.matchMedia = original;
    }
  },
};

export const DialogCloseLabelFromStrings: Story = {
  render: () => (
    <UiStringsProvider locale="es">
      <Simple />
    </UiStringsProvider>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Abrir" }));
    const dialog = await screen.findByRole("dialog");
    await expect(within(dialog).getByRole("button", { name: "Cerrar" })).toBeInTheDocument();
  },
};

export const DialogCloseLabelOverride: Story = {
  render: () => <Simple closeLabel="Salir" />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Abrir" }));
    const dialog = await screen.findByRole("dialog");
    await expect(within(dialog).getByRole("button", { name: "Salir" })).toBeInTheDocument();
  },
};
