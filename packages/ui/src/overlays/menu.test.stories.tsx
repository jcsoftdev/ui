import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
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
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./dropdown-menu/dropdown-menu.js";

const meta = {
  title: "Tests/Menu",
  tags: ["!autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const trigger = (canvasElement: HTMLElement) =>
  within(canvasElement).getByRole("button", { name: "Acciones", hidden: true });
const menus = () => screen.queryAllByRole("menu");
const activeName = () => document.activeElement?.textContent?.trim();
const focusTrigger = (canvasElement: HTMLElement) => {
  const button = trigger(canvasElement);
  button.focus();
  return button;
};

interface FruitsProps {
  onSelect?: (event: Event) => void;
  contentClassName?: string;
  modal?: boolean;
  dir?: "ltr" | "rtl";
}

function Fruits({ onSelect, contentClassName, modal, dir }: FruitsProps) {
  return (
    <div className="p-24">
      <button type="button">Antes</button>
      <DropdownMenu {...(modal === undefined ? {} : { modal })} {...(dir ? { dir } : {})}>
        <DropdownMenuTrigger asChild>
          <Button>Acciones</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent aria-label="Frutas" className={contentClassName}>
          <DropdownMenuItem onSelect={onSelect}>Manzana</DropdownMenuItem>
          <DropdownMenuItem>Palta</DropdownMenuItem>
          <DropdownMenuItem disabled>Banano</DropdownMenuItem>
          <DropdownMenuItem>Arandano</DropdownMenuItem>
          <DropdownMenuItem textValue="Zapote">Fruta rara</DropdownMenuItem>
          <DropdownMenuItem>Durazno</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <button type="button">Despues</button>
    </div>
  );
}

const fruits: Story = { render: () => <Fruits /> };

async function openWith(canvasElement: HTMLElement, key: string) {
  focusTrigger(canvasElement);
  await userEvent.keyboard(key);
  return screen.findByRole("menu");
}

export const OpensWithEnterAndFocusesFirst: Story = {
  ...fruits,
  play: async ({ canvasElement }) => {
    const menu = await openWith(canvasElement, "{Enter}");
    await expect(trigger(canvasElement)).toHaveAttribute("aria-haspopup", "menu");
    await expect(trigger(canvasElement)).toHaveAttribute("aria-expanded", "true");
    await expect(trigger(canvasElement)).toHaveAttribute("aria-controls", menu.id);
    await expect(trigger(canvasElement)).toHaveAttribute("data-state", "open");
    await expect(menu).toHaveAttribute("data-state", "open");
    await waitFor(() => expect(activeName()).toBe("Manzana"));
    await expect(document.activeElement).toHaveAttribute("data-highlighted");
  },
};

export const OpensWithSpaceAndFocusesFirst: Story = {
  ...fruits,
  play: async ({ canvasElement }) => {
    await openWith(canvasElement, " ");
    await waitFor(() => expect(activeName()).toBe("Manzana"));
  },
};

export const OpensWithArrowDownAndFocusesFirst: Story = {
  ...fruits,
  play: async ({ canvasElement }) => {
    await openWith(canvasElement, "{ArrowDown}");
    await waitFor(() => expect(activeName()).toBe("Manzana"));
  },
};

export const OpensWithArrowUpAndFocusesLast: Story = {
  ...fruits,
  play: async ({ canvasElement }) => {
    await openWith(canvasElement, "{ArrowUp}");
    await waitFor(() => expect(activeName()).toBe("Durazno"));
  },
};

export const PointerOpenFocusesMenuNotItems: Story = {
  ...fruits,
  play: async ({ canvasElement }) => {
    await userEvent.click(trigger(canvasElement));
    const menu = await screen.findByRole("menu");
    await waitFor(() => expect(document.activeElement).toBe(menu));
    await expect(menu.querySelector("[data-highlighted]")).toBeNull();
  },
};

export const ArrowsRoveWithLoopAndSkipDisabled: Story = {
  ...fruits,
  play: async ({ canvasElement }) => {
    await openWith(canvasElement, "{Enter}");
    await waitFor(() => expect(activeName()).toBe("Manzana"));
    await userEvent.keyboard("{ArrowDown}");
    await expect(activeName()).toBe("Palta");
    await userEvent.keyboard("{ArrowDown}");
    await expect(activeName()).toBe("Arandano");
    await userEvent.keyboard("{ArrowUp}{ArrowUp}");
    await expect(activeName()).toBe("Manzana");
    await userEvent.keyboard("{ArrowUp}");
    await expect(activeName()).toBe("Durazno");
    await userEvent.keyboard("{ArrowDown}");
    await expect(activeName()).toBe("Manzana");
    await userEvent.keyboard("{End}");
    await expect(activeName()).toBe("Durazno");
    await userEvent.keyboard("{Home}");
    await expect(activeName()).toBe("Manzana");
  },
};

export const TypeaheadFocusesAndCycles: Story = {
  ...fruits,
  play: async ({ canvasElement }) => {
    await openWith(canvasElement, "{Enter}");
    await waitFor(() => expect(activeName()).toBe("Manzana"));
    await userEvent.keyboard("d");
    await expect(activeName()).toBe("Durazno");
    await pause(1100);
    await userEvent.keyboard("a");
    await expect(activeName()).toBe("Arandano");
    // Repeating the same letter cycles to the next match: Arandano -> Manzana is not an "a"
    // item, so it wraps back to the only other one (itself excluded) which is none -> stays.
    await userEvent.keyboard("a");
    await expect(activeName()).toBe("Arandano");
    await pause(1100);
    // textValue wins over the visible text.
    await userEvent.keyboard("z");
    await expect(activeName()).toBe("Fruta rara");
    await pause(1100);
    // Disabled items are never matched.
    await userEvent.keyboard("b");
    await expect(activeName()).toBe("Fruta rara");
  },
};

export const TypeaheadCyclesRepeatedLetter: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>Acciones</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Pera</DropdownMenuItem>
        <DropdownMenuItem>Pina</DropdownMenuItem>
        <DropdownMenuItem>Papaya</DropdownMenuItem>
        <DropdownMenuItem>Uva</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
  play: async ({ canvasElement }) => {
    await openWith(canvasElement, "{Enter}");
    await userEvent.keyboard("p");
    await expect(activeName()).toBe("Pina");
    await userEvent.keyboard("p");
    await expect(activeName()).toBe("Papaya");
    await userEvent.keyboard("p");
    await expect(activeName()).toBe("Pera");
    await pause(1100);
    await userEvent.keyboard("pi");
    await expect(activeName()).toBe("Pina");
  },
};

export const SelectClosesAndReturnsFocus: Story = {
  render: () => <Fruits onSelect={fn()} />,
  play: async ({ canvasElement }) => {
    await userEvent.click(trigger(canvasElement));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Manzana" }));
    await waitFor(() => expect(menus()).toHaveLength(0));
    await waitFor(() => expect(document.activeElement).toBe(trigger(canvasElement)));
    await expect(trigger(canvasElement)).toHaveAttribute("aria-expanded", "false");
  },
};

export const EnterSelectsFocusedItem: Story = {
  render: () => <Fruits onSelect={fn()} />,
  play: async ({ canvasElement }) => {
    await openWith(canvasElement, "{Enter}");
    await waitFor(() => expect(activeName()).toBe("Manzana"));
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(menus()).toHaveLength(0));
    await waitFor(() => expect(document.activeElement).toBe(trigger(canvasElement)));
  },
};

export const PreventDefaultOnSelectKeepsOpen: Story = {
  render: () => <Fruits onSelect={(event) => event.preventDefault()} />,
  play: async ({ canvasElement }) => {
    await userEvent.click(trigger(canvasElement));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Manzana" }));
    await pause(100);
    await expect(menus()).toHaveLength(1);
  },
};

export const DisabledItemDoesNotSelect: Story = {
  render: () => <Fruits />,
  play: async ({ canvasElement }) => {
    await userEvent.click(trigger(canvasElement));
    const banano = await screen.findByRole("menuitem", { name: "Banano" });
    await expect(banano).toHaveAttribute("aria-disabled", "true");
    await expect(banano).toHaveAttribute("data-disabled");
    banano.click();
    await pause(100);
    await expect(menus()).toHaveLength(1);
  },
};

export const TabClosesMenu: Story = {
  ...fruits,
  play: async ({ canvasElement }) => {
    await openWith(canvasElement, "{Enter}");
    await waitFor(() => expect(activeName()).toBe("Manzana"));
    await userEvent.keyboard("{Tab}");
    await pause(200);
    await waitFor(() => expect(menus()).toHaveLength(0));
  },
};

export const EscapeClosesAndReturnsFocus: Story = {
  ...fruits,
  play: async ({ canvasElement }) => {
    await openWith(canvasElement, "{Enter}");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(menus()).toHaveLength(0));
    await waitFor(() => expect(document.activeElement).toBe(trigger(canvasElement)));
  },
};

export const OutsideClickClosesAndModalBlocksPage: Story = {
  ...fruits,
  play: async ({ canvasElement }) => {
    await userEvent.click(trigger(canvasElement));
    const menu = await screen.findByRole("menu");
    await expect(document.body.style.pointerEvents).toBe("none");
    await expect(menu.parentElement?.parentElement).not.toBeNull();
    await expect(canvasElement.closest("[aria-hidden=true],[inert]")).not.toBeNull();
    const after = within(canvasElement).getByRole("button", { name: "Despues", hidden: true });
    await expect(getComputedStyle(after).pointerEvents).toBe("none");
    await userEvent.click(document.body, { pointerEventsCheck: 0 });
    await waitFor(() => expect(menus()).toHaveLength(0));
    await expect(document.body.style.pointerEvents).not.toBe("none");
    await expect(canvasElement.closest("[aria-hidden=true],[inert]")).toBeNull();
  },
};

export const NonModalOutsideClickPassesThroughAndKeepsFocus: Story = {
  render: () => <Fruits modal={false} />,
  play: async ({ canvasElement }) => {
    await userEvent.click(trigger(canvasElement));
    await screen.findByRole("menu");
    await expect(document.body.style.pointerEvents).not.toBe("none");
    const after = within(canvasElement).getByRole("button", { name: "Despues", hidden: true });
    await userEvent.click(after);
    await waitFor(() => expect(menus()).toHaveLength(0));
    await waitFor(() => expect(document.activeElement).toBe(after));
  },
};

export const TriggerClickTogglesOnce: Story = {
  render: () => <Fruits modal={false} />,
  play: async ({ canvasElement }) => {
    await userEvent.click(trigger(canvasElement));
    await screen.findByRole("menu");
    await userEvent.click(trigger(canvasElement));
    await waitFor(() => expect(menus()).toHaveLength(0));
    await pause(100);
    await expect(menus()).toHaveLength(0);
  },
};

export const HighlightFollowsPointer: Story = {
  ...fruits,
  play: async ({ canvasElement }) => {
    await userEvent.click(trigger(canvasElement));
    const palta = await screen.findByRole("menuitem", { name: "Palta" });
    const durazno = screen.getByRole("menuitem", { name: "Durazno" });
    await userEvent.hover(palta);
    await waitFor(() => expect(palta).toHaveAttribute("data-highlighted"));
    await expect(document.activeElement).toBe(palta);
    await userEvent.hover(durazno);
    await waitFor(() => expect(durazno).toHaveAttribute("data-highlighted"));
    await expect(palta).not.toHaveAttribute("data-highlighted");
  },
};

export const ClassNameOverrideWins: Story = {
  render: () => <Fruits contentClassName="p-8 min-w-[300px]" />,
  play: async ({ canvasElement }) => {
    await userEvent.click(trigger(canvasElement));
    const menu = await screen.findByRole("menu");
    await expect(getComputedStyle(menu).paddingTop).toBe("32px");
    await expect(menu.getBoundingClientRect().width).toBeGreaterThanOrEqual(300);
  },
};

export const CheckboxAndRadioItemsExposeState: Story = {
  render: function Render() {
    const [bold, setBold] = useState<boolean | "indeterminate">(false);
    const [size, setSize] = useState("m");
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button>Acciones</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Formato</DropdownMenuLabel>
          <DropdownMenuCheckboxItem checked={bold} onCheckedChange={setBold}>
            Negrita
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup value={size} onValueChange={setSize}>
            <DropdownMenuRadioItem value="s">Chico</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="m">Medio</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(trigger(canvasElement));
    const bold = await screen.findByRole("menuitemcheckbox", { name: "Negrita" });
    await expect(bold).toHaveAttribute("aria-checked", "false");
    await expect(bold).toHaveAttribute("data-state", "unchecked");
    await userEvent.click(bold);
    await waitFor(() => expect(menus()).toHaveLength(0));
    await userEvent.click(trigger(canvasElement));
    const again = await screen.findByRole("menuitemcheckbox", { name: "Negrita" });
    await expect(again).toHaveAttribute("aria-checked", "true");
    await expect(again).toHaveAttribute("data-state", "checked");
    const medio = screen.getByRole("menuitemradio", { name: "Medio" });
    const chico = screen.getByRole("menuitemradio", { name: "Chico" });
    await expect(medio).toHaveAttribute("aria-checked", "true");
    await expect(chico).toHaveAttribute("aria-checked", "false");
    await expect(screen.getByRole("group")).toBeInTheDocument();
    await userEvent.click(chico);
    await waitFor(() => expect(menus()).toHaveLength(0));
    await userEvent.click(trigger(canvasElement));
    await expect(await screen.findByRole("menuitemradio", { name: "Chico" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  },
};

function WithSub({ dir }: { dir?: "ltr" | "rtl" }) {
  return (
    <div dir={dir} className="p-24">
      <DropdownMenu {...(dir ? { dir } : {})}>
        <DropdownMenuTrigger asChild>
          <Button>Acciones</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Uno</DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Mas</DropdownMenuSubTrigger>
            <DropdownMenuSubContent aria-label="Mas opciones">
              <DropdownMenuItem>Sub A</DropdownMenuItem>
              <DropdownMenuItem>Sub B</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem>Tres</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export const SubmenuOpensWithArrowRightAndClosesWithArrowLeft: Story = {
  render: () => <WithSub />,
  play: async ({ canvasElement }) => {
    await openWith(canvasElement, "{Enter}");
    await userEvent.keyboard("{ArrowDown}");
    const subTrigger = screen.getByRole("menuitem", { name: "Mas" });
    await expect(subTrigger).toHaveAttribute("aria-haspopup", "menu");
    await expect(subTrigger).toHaveAttribute("aria-expanded", "false");
    await userEvent.keyboard("{ArrowRight}");
    await waitFor(() => expect(menus()).toHaveLength(2));
    await waitFor(() => expect(activeName()).toBe("Sub A"));
    await expect(subTrigger).toHaveAttribute("aria-expanded", "true");
    await userEvent.keyboard("{ArrowDown}");
    await expect(activeName()).toBe("Sub B");
    await userEvent.keyboard("{ArrowLeft}");
    await waitFor(() => expect(menus()).toHaveLength(1));
    await expect(document.activeElement).toBe(subTrigger);
  },
};

export const SubmenuOpensWithPointerAndSelectCloses: Story = {
  render: () => <WithSub />,
  play: async ({ canvasElement }) => {
    await userEvent.click(trigger(canvasElement));
    const subTrigger = await screen.findByRole("menuitem", { name: "Mas" });
    await userEvent.hover(subTrigger);
    await waitFor(() => expect(menus()).toHaveLength(2));
    await userEvent.click(screen.getByRole("menuitem", { name: "Sub B" }));
    await waitFor(() => expect(menus()).toHaveLength(0));
  },
};

export const EscapeClosesSubmenuThenMenu: Story = {
  render: () => <WithSub />,
  play: async ({ canvasElement }) => {
    await openWith(canvasElement, "{Enter}");
    await userEvent.keyboard("{ArrowDown}{ArrowRight}");
    await waitFor(() => expect(menus()).toHaveLength(2));
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(menus()).toHaveLength(1));
    await expect(activeName()).toBe("Mas");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(menus()).toHaveLength(0));
  },
};

export const HoveringAnotherItemClosesSubmenu: Story = {
  render: () => <WithSub />,
  play: async ({ canvasElement }) => {
    await userEvent.click(trigger(canvasElement));
    await userEvent.hover(await screen.findByRole("menuitem", { name: "Mas" }));
    await waitFor(() => expect(menus()).toHaveLength(2));
    await userEvent.hover(screen.getByRole("menuitem", { name: "Tres" }));
    await waitFor(() => expect(menus()).toHaveLength(1));
  },
};

export const RtlSwapsSubmenuKeys: Story = {
  render: () => <WithSub dir="rtl" />,
  play: async ({ canvasElement }) => {
    await openWith(canvasElement, "{Enter}");
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard("{ArrowRight}");
    await pause(100);
    await expect(menus()).toHaveLength(1);
    await userEvent.keyboard("{ArrowLeft}");
    await waitFor(() => expect(menus()).toHaveLength(2));
    const [root, sub] = menus();
    await expect(root?.getAttribute("dir")).toBe("rtl");
    await waitFor(() =>
      expect(
        (root?.getBoundingClientRect().left ?? 0) - (sub?.getBoundingClientRect().right ?? 0),
      ).toBeGreaterThanOrEqual(-8),
    );
    await userEvent.keyboard("{ArrowRight}");
    await waitFor(() => expect(menus()).toHaveLength(1));
  },
};

export const MenuInsideDialogEscapeClosesOnlyMenu: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Abrir</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Con menu</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <WithSub />
        </DialogBody>
      </DialogContent>
    </Dialog>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Abrir" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Acciones" }));
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    await userEvent.keyboard("{ArrowRight}");
    await waitFor(() => expect(menus()).toHaveLength(2));
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(menus()).toHaveLength(1));
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(menus()).toHaveLength(0));
    await pause(100);
    await expect(screen.queryAllByRole("dialog")).toHaveLength(1);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryAllByRole("dialog")).toHaveLength(0));
  },
};
