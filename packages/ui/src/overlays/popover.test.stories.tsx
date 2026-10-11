import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
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
import {
  Popover,
  PopoverAnchor,
  PopoverArrow,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "./popover/popover.js";

const meta = {
  title: "Tests/Popover",
  tags: ["!autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const popover = () => screen.queryByRole("dialog", { name: "Ficha" });
const open = (canvasElement: HTMLElement) =>
  userEvent.click(within(canvasElement).getByRole("button", { name: "Abrir" }));

function Basic({
  modal,
  contentClassName,
  side,
  align,
  triggerClassName = "",
}: {
  modal?: boolean;
  contentClassName?: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  triggerClassName?: string;
}) {
  return (
    <div className="p-24">
      <button type="button">Antes</button>
      <Popover modal={modal ?? false}>
        <PopoverTrigger asChild>
          <Button className={triggerClassName}>Abrir</Button>
        </PopoverTrigger>
        <PopoverContent aria-label="Ficha" className={contentClassName} side={side} align={align}>
          <input aria-label="Nombre" />
          <PopoverClose asChild>
            <Button size="sm" variant="secondary">
              Cerrar
            </Button>
          </PopoverClose>
        </PopoverContent>
      </Popover>
      <button type="button">Despues</button>
    </div>
  );
}

export const OpensWithClickAndKeyboard: Story = {
  render: () => <Basic />,
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", { name: "Abrir" });
    await expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(trigger).toHaveAttribute("data-state", "closed");
    await expect(trigger).not.toHaveAttribute("aria-controls");

    await userEvent.click(trigger);
    const content = await screen.findByRole("dialog", { name: "Ficha" });
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(trigger).toHaveAttribute("data-state", "open");
    await expect(trigger).toHaveAttribute("aria-controls", content.id);
    await expect(content).toHaveAttribute("data-state", "open");
    await expect(content).toHaveAttribute("data-side");
    await expect(content).toHaveAttribute("data-align");
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveFocus());

    await userEvent.click(trigger);
    await waitFor(() => expect(popover()).toBeNull());
    await expect(trigger).toHaveFocus();

    trigger.focus();
    await userEvent.keyboard("{Enter}");
    await screen.findByRole("dialog", { name: "Ficha" });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(popover()).toBeNull());
    trigger.focus();
    await userEvent.keyboard(" ");
    await screen.findByRole("dialog", { name: "Ficha" });
    await userEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    await waitFor(() => expect(popover()).toBeNull());
    await expect(trigger).toHaveFocus();
  },
};

export const EscapeClosesAndReturnsFocus: Story = {
  render: () => <Basic />,
  play: async ({ canvasElement }) => {
    await open(canvasElement);
    await screen.findByRole("dialog", { name: "Ficha" });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(popover()).toBeNull());
    await expect(within(canvasElement).getByRole("button", { name: "Abrir" })).toHaveFocus();
  },
};

export const OutsideClickCloses: Story = {
  render: () => <Basic />,
  play: async ({ canvasElement }) => {
    await open(canvasElement);
    const content = await screen.findByRole("dialog", { name: "Ficha" });
    await userEvent.click(within(content).getByRole("textbox", { name: "Nombre" }));
    await expect(popover()).toBeInTheDocument();
    const outside = within(canvasElement).getByRole("button", { name: "Despues" });
    await userEvent.click(outside);
    await waitFor(() => expect(popover()).toBeNull());
    // Focus stays where the user pressed.
    await waitFor(() => expect(outside).toHaveFocus());
  },
};

export const TabOutOfNonModalCloses: Story = {
  render: () => <Basic />,
  play: async ({ canvasElement }) => {
    await open(canvasElement);
    await screen.findByRole("dialog", { name: "Ficha" });
    await userEvent.tab();
    await expect(screen.getByRole("button", { name: "Cerrar" })).toHaveFocus();
    await userEvent.tab();
    await waitFor(() => expect(popover()).toBeNull());
    // Focus continues after the trigger instead of leaving the page.
    await expect(within(canvasElement).getByRole("button", { name: "Despues" })).toHaveFocus();
  },
};

export const ShiftTabOutOfNonModalReturnsToTrigger: Story = {
  render: () => <Basic />,
  play: async ({ canvasElement }) => {
    await open(canvasElement);
    await screen.findByRole("dialog", { name: "Ficha" });
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveFocus());
    await userEvent.tab({ shift: true });
    await waitFor(() => expect(popover()).toBeNull());
    await expect(within(canvasElement).getByRole("button", { name: "Abrir" })).toHaveFocus();
  },
};

export const ModalTrapsFocusAndHidesPage: Story = {
  render: () => <Basic modal />,
  play: async ({ canvasElement }) => {
    const body = document.body;
    const before = body.style.overflow;
    await open(canvasElement);
    const content = await screen.findByRole("dialog", { name: "Ficha" });
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveFocus());
    await userEvent.tab();
    await expect(screen.getByRole("button", { name: "Cerrar" })).toHaveFocus();
    await userEvent.tab();
    await expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveFocus();
    await userEvent.tab({ shift: true });
    await expect(screen.getByRole("button", { name: "Cerrar" })).toHaveFocus();
    await expect(content.contains(document.activeElement)).toBe(true);
    await expect(body.style.overflow).toBe("hidden");
    await expect(canvasElement.closest("[inert], [aria-hidden=true]")).not.toBeNull();

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(popover()).toBeNull());
    await expect(body.style.overflow).toBe(before);
    await expect(canvasElement.closest("[inert], [aria-hidden=true]")).toBeNull();
    await expect(within(canvasElement).getByRole("button", { name: "Abrir" })).toHaveFocus();
  },
};

const fixedTrigger = (position: string) => (
  <div className="fixed" style={{ ...parse(position) }}>
    <Popover defaultOpen>
      <PopoverTrigger asChild>
        <Button>Abrir</Button>
      </PopoverTrigger>
      <PopoverContent aria-label="Ficha" className="h-40 w-64" />
    </Popover>
  </div>
);

function parse(position: string): Record<string, string> {
  return Object.fromEntries(position.split(";").map((pair) => pair.split(":") as [string, string]));
}

export const FlipsNearBottomEdge: Story = {
  render: () => fixedTrigger("bottom:8px;left:200px"),
  play: async () => {
    const content = await screen.findByRole("dialog", { name: "Ficha" });
    await waitFor(() => expect(content).toHaveAttribute("data-side", "top"));
    const rect = content.getBoundingClientRect();
    const trigger = screen.getByRole("button", { name: "Abrir" }).getBoundingClientRect();
    await expect(rect.bottom).toBeLessThanOrEqual(trigger.top);
    await expect(rect.top).toBeGreaterThanOrEqual(0);
  },
};

export const StaysBottomWhenThereIsRoom: Story = {
  render: () => fixedTrigger("top:40px;left:200px"),
  play: async () => {
    const content = await screen.findByRole("dialog", { name: "Ficha" });
    await waitFor(() => expect(content).toHaveAttribute("data-side", "bottom"));
    await expect(content.parentElement).toHaveAttribute("data-ui-popper-wrapper");
    const style = getComputedStyle(content.parentElement as HTMLElement);
    await expect(style.getPropertyValue("--ui-popper-anchor-width")).toMatch(/px$/);
    await expect(
      Number.parseFloat(style.getPropertyValue("--ui-popper-available-height")),
    ).toBeGreaterThan(100);
    await expect(style.getPropertyValue("--ui-popper-transform-origin")).toMatch(/px/);
  },
};

export const ShiftsNearRightEdgeAndStaysInViewport: Story = {
  render: () => fixedTrigger("top:60px;right:4px"),
  play: async () => {
    const content = await screen.findByRole("dialog", { name: "Ficha" });
    await waitFor(() => {
      const rect = content.getBoundingClientRect();
      expect(rect.right).toBeLessThanOrEqual(document.documentElement.clientWidth);
      expect(rect.left).toBeGreaterThanOrEqual(0);
    });
    await expect(content).toHaveAttribute("data-side", "bottom");
  },
};

export const RepositionsOnScroll: Story = {
  render: () => (
    <div data-testid="scroller" className="h-72 w-96 overflow-auto border" style={{ margin: 40 }}>
      <div style={{ height: 800, paddingTop: 120 }}>
        <Popover defaultOpen>
          <PopoverTrigger asChild>
            <Button>Abrir</Button>
          </PopoverTrigger>
          <PopoverContent aria-label="Ficha" className="h-16 w-40" />
        </Popover>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const content = await screen.findByRole("dialog", { name: "Ficha" });
    const scroller = within(canvasElement).getByTestId("scroller");
    const trigger = screen.getByRole("button", { name: "Abrir" });
    await waitFor(() => expect(content).toHaveAttribute("data-side"));
    const gap = () => content.getBoundingClientRect().top - trigger.getBoundingClientRect().top;
    const startGap = gap();
    scroller.scrollTop = 60;
    await waitFor(() => expect(Math.abs(gap() - startGap)).toBeLessThan(1.5));
    await expect(trigger.getBoundingClientRect().top).toBeLessThan(200);
  },
};

export const RtlAlignStartFollowsReadingDirection: Story = {
  render: () => (
    <div dir="rtl" className="p-24">
      <Popover defaultOpen>
        <PopoverTrigger asChild>
          <Button className="w-40">Abrir</Button>
        </PopoverTrigger>
        <PopoverContent aria-label="Ficha" align="start" className="w-72" />
      </Popover>
    </div>
  ),
  play: async () => {
    const content = await screen.findByRole("dialog", { name: "Ficha" });
    const trigger = screen.getByRole("button", { name: "Abrir" });
    await waitFor(() =>
      expect(
        Math.abs(content.getBoundingClientRect().right - trigger.getBoundingClientRect().right),
      ).toBeLessThan(1.5),
    );
  },
};

export const ArrowPointsAtAnchor: Story = {
  render: () => (
    <div className="p-24">
      <Popover defaultOpen>
        <PopoverTrigger asChild>
          <Button className="w-40">Abrir</Button>
        </PopoverTrigger>
        <PopoverContent aria-label="Ficha" className="w-72 text-ink">
          <PopoverArrow data-testid="arrow" />
        </PopoverContent>
      </Popover>
    </div>
  ),
  play: async () => {
    const arrow = await screen.findByTestId("arrow");
    const trigger = screen.getByRole("button", { name: "Abrir" });
    await waitFor(() => {
      const a = arrow.getBoundingClientRect();
      const t = trigger.getBoundingClientRect();
      expect(Math.abs(a.left + a.width / 2 - (t.left + t.width / 2))).toBeLessThan(1.5);
      expect(Math.abs(a.top - (t.bottom + 1))).toBeLessThan(8);
    });
  },
};

function NestedInDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Abrir dialogo</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cita</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Popover>
            <PopoverTrigger asChild>
              <Button>Abrir</Button>
            </PopoverTrigger>
            <PopoverContent aria-label="Ficha">
              <button type="button">Dentro</button>
            </PopoverContent>
          </Popover>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

export const NestedPopoverInDialogEscapeClosesOnlyPopover: Story = {
  render: () => <NestedInDialog />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Abrir dialogo" }));
    const dialog = await screen.findByRole("dialog", { name: "Cita" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Abrir" }));
    await screen.findByRole("dialog", { name: "Ficha" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Dentro" })).toHaveFocus());
    // Interacting inside the popover does not dismiss the dialog.
    await userEvent.click(screen.getByRole("button", { name: "Dentro" }));
    await expect(dialog).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(popover()).toBeNull());
    await expect(screen.getByRole("dialog", { name: "Cita" })).toBeInTheDocument();
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "Abrir" })).toHaveFocus(),
    );

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Cita" })).toBeNull());
  },
};

const MOTION_CSS = `
@keyframes pop-out { from { opacity: 1 } to { opacity: 0 } }
.pop-exit[data-state="closed"] { animation: pop-out 400ms forwards; }
`;

export const ExitAnimationKeepsContentUntilItEnds: Story = {
  render: () => (
    <>
      <style>{MOTION_CSS}</style>
      <Basic contentClassName="pop-exit" />
    </>
  ),
  play: async ({ canvasElement }) => {
    await open(canvasElement);
    const content = await screen.findByRole("dialog", { name: "Ficha" });
    await userEvent.keyboard("{Escape}");
    await expect(content).toBeInTheDocument();
    await expect(content).toHaveAttribute("data-state", "closed");
    await new Promise((resolve) => setTimeout(resolve, 150));
    await expect(content).toBeInTheDocument();
    await waitFor(() => expect(content).not.toBeInTheDocument(), { timeout: 1500 });
  },
};

export const ClassNameOverrideWins: Story = {
  render: () => <Basic contentClassName="p-6 rounded-none max-w-sm" />,
  play: async ({ canvasElement }) => {
    await open(canvasElement);
    const content = await screen.findByRole("dialog", { name: "Ficha" });
    const style = getComputedStyle(content);
    await expect(style.paddingLeft).toBe("24px");
    await expect(style.borderTopLeftRadius).toBe("0px");
  },
};

function Controlled() {
  const [isOpen, setOpen] = useState(false);
  return (
    <div className="p-24">
      <Popover open={isOpen} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div data-testid="anchor" className="inline-block border p-2">
            Ancla
          </div>
        </PopoverAnchor>
        <PopoverTrigger asChild>
          <Button>Abrir</Button>
        </PopoverTrigger>
        <PopoverContent aria-label="Ficha" align="start" />
      </Popover>
      <output data-testid="state">{String(isOpen)}</output>
    </div>
  );
}

export const ControlledWithCustomAnchor: Story = {
  render: () => <Controlled />,
  play: async ({ canvasElement }) => {
    await open(canvasElement);
    const content = await screen.findByRole("dialog", { name: "Ficha" });
    await expect(within(canvasElement).getByTestId("state")).toHaveTextContent("true");
    const anchor = within(canvasElement).getByTestId("anchor").getBoundingClientRect();
    await waitFor(() => {
      const rect = content.getBoundingClientRect();
      expect(Math.abs(rect.left - anchor.left)).toBeLessThan(1.5);
      expect(rect.top).toBeGreaterThanOrEqual(anchor.bottom);
    });
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(within(canvasElement).getByTestId("state")).toHaveTextContent("false"),
    );
  },
};

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const translateOf = (transform: string): number[] | null => {
  const match = transform.match(/translate3d\((-?[\d.]+)px,\s*(-?[\d.]+)px/);
  return match ? [Number(match[1]), Number(match[2])] : null;
};

export const SizeLimitedContentIsPlacedCorrectlyOnFirstFrame: Story = {
  render: () => (
    <div className="fixed inset-0">
      <div style={{ position: "absolute", top: window.innerHeight - 80, left: 100 }}>
        <Popover>
          <PopoverTrigger asChild>
            <Button>Abrir</Button>
          </PopoverTrigger>
          <PopoverContent
            aria-label="Ficha"
            className="max-h-(--ui-popper-available-height) overflow-auto"
          >
            <div style={{ height: 3000 }}>Largo</div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const seen: number[] = [];
    const record = () => {
      for (const wrapper of document.querySelectorAll<HTMLElement>("[data-ui-popper-wrapper]")) {
        const at = translateOf(wrapper.style.transform);
        if (at) seen.push(at[1] as number);
      }
    };
    const observer = new MutationObserver(record);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true });
    await open(canvasElement);
    await screen.findByRole("dialog", { name: "Ficha" });
    await pause(100);
    observer.disconnect();
    await expect(seen.length).toBeGreaterThan(0);
    // Every written position keeps the content on screen: none computed for the unlimited height.
    await expect(Math.min(...seen)).toBeGreaterThanOrEqual(0);
  },
};

export const PortalInsideTransformedAncestorStaysAnchored: Story = {
  render: function Render() {
    const [scope, setScope] = useState<HTMLElement | null>(null);
    return (
      <div className="p-24">
        <div
          ref={setScope}
          style={{ transform: "translate(40px, 30px)", position: "relative", padding: 10 }}
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button>Abrir</Button>
          </PopoverTrigger>
          <PopoverContent aria-label="Ficha" container={scope}>
            Contenido
          </PopoverContent>
        </Popover>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    await open(canvasElement);
    const content = await screen.findByRole("dialog", { name: "Ficha" });
    await pause(100);
    const trigger = within(canvasElement).getByRole("button", { name: "Abrir" });
    const gap = content.getBoundingClientRect().top - trigger.getBoundingClientRect().bottom;
    await expect(Math.abs(gap - 6)).toBeLessThan(2);
    const wrapper = content.closest("[data-ui-popper-wrapper]");
    await expect(wrapper?.getAttribute("dir")).toBe("ltr");
  },
};

export const ClickingTriggerWhileOpenClosesEvenIfAncestorTakesFocus: Story = {
  render: () => (
    <div tabIndex={-1} data-testid="ancestor" className="p-24">
      <Popover>
        <PopoverTrigger asChild>
          {/* biome-ignore lint/a11y/useSemanticElements lint/a11y/useFocusableInteractive: a non-focusable trigger is the scenario under test */}
          <span role="button" className="inline-block p-2">
            Abrir
          </span>
        </PopoverTrigger>
        <PopoverContent aria-label="Ficha">Contenido</PopoverContent>
      </Popover>
    </div>
  ),
  parameters: { a11y: { test: "todo" } },
  play: async ({ canvasElement }) => {
    await open(canvasElement);
    await screen.findByRole("dialog", { name: "Ficha" });
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Abrir" }));
    await waitFor(() => expect(popover()).toBeNull());
    await pause(200);
    await expect(popover()).toBeNull();
  },
};

export const TabOutWithNonTabbableTriggerGoesToNextTabbable: Story = {
  render: () => (
    <div className="p-24">
      <button type="button">Primero</button>
      <Popover>
        <PopoverTrigger asChild>
          <Button tabIndex={-1}>Abrir</Button>
        </PopoverTrigger>
        <PopoverContent aria-label="Ficha">
          <button type="button">Dentro</button>
        </PopoverContent>
      </Popover>
      <button type="button">Siguiente</button>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await open(canvasElement);
    await screen.findByRole("dialog", { name: "Ficha" });
    await waitFor(() => expect(document.activeElement?.textContent).toBe("Dentro"));
    await userEvent.tab();
    await waitFor(() => expect(popover()).toBeNull());
    await expect(document.activeElement?.textContent).toBe("Siguiente");
  },
};

export const PortalInsideScrolledTransformedContainerStaysAnchored: Story = {
  render: function Render() {
    const [scope, setScope] = useState<HTMLElement | null>(null);
    return (
      <div className="p-24">
        <div
          ref={(node) => {
            setScope(node);
            if (node) node.scrollTop = 120;
          }}
          style={{
            transform: "translate(40px, 30px)",
            position: "relative",
            overflow: "auto",
            height: 200,
            width: 200,
          }}
        >
          <div style={{ height: 800 }} />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button>Abrir</Button>
          </PopoverTrigger>
          <PopoverContent aria-label="Ficha" container={scope}>
            Contenido
          </PopoverContent>
        </Popover>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    await open(canvasElement);
    const content = await screen.findByRole("dialog", { name: "Ficha" });
    await pause(100);
    const trigger = within(canvasElement).getByRole("button", { name: "Abrir" });
    const container = content.closest("[data-ui-popper-wrapper]")?.parentElement;
    await expect(container?.scrollTop).toBe(120);
    const gap = content.getBoundingClientRect().top - trigger.getBoundingClientRect().bottom;
    await expect(Math.abs(gap - 6)).toBeLessThan(2);
  },
};

export const EscapeClosesOnlyTheTopmostOfDialogAndPopoverOpenTogether: Story = {
  render: () => (
    <div className="p-24">
      <Dialog defaultOpen>
        <DialogTrigger asChild>
          <Button>Abrir dialogo</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dialogo</DialogTitle>
          </DialogHeader>
          <DialogBody>Cuerpo</DialogBody>
        </DialogContent>
      </Dialog>
      <Popover defaultOpen>
        <PopoverTrigger asChild>
          <Button>Abrir</Button>
        </PopoverTrigger>
        <PopoverContent aria-label="Ficha">Contenido</PopoverContent>
      </Popover>
    </div>
  ),
  play: async () => {
    await screen.findByRole("dialog", { name: "Dialogo", hidden: true });
    await screen.findByRole("dialog", { name: "Ficha", hidden: true });
    (document.activeElement as HTMLElement | null)?.blur();
    await userEvent.keyboard("{Escape}");
    await pause(300);
    const open = screen.queryAllByRole("dialog", { hidden: true });
    await expect(open).toHaveLength(1);
  },
};
