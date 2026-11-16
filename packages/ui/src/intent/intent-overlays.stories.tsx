import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ReactNode, useMemo, useState } from "react";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import { AlertDialog } from "../overlays/alert-dialog/alert-dialog.js";
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "../overlays/context-menu/context-menu.js";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../overlays/dialog/dialog.js";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "../overlays/drawer/drawer.js";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../overlays/dropdown-menu/dropdown-menu.js";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../overlays/hover-card/hover-card.js";
import { Popover, PopoverContent, PopoverTrigger } from "../overlays/popover/popover.js";
import { IntentBridgeProvider } from "./bridge.js";
import type { IntentBridge } from "./types.js";

function RecordingBridge({ children }: { children: ReactNode }) {
  const [log, setLog] = useState<string[]>([]);
  const bridge = useMemo<IntentBridge>(
    () => ({
      registerTarget(ref, _element, expectation) {
        const entry = `${ref.intent}:${ref.key ?? ""}:${expectation.role}`;
        setLog((current) => [...current, entry]);
        return () => setLog((current) => current.filter((item) => item !== entry));
      },
    }),
    [],
  );
  return (
    <IntentBridgeProvider bridge={bridge}>
      {children}
      <output data-testid="log">{log.join("|")}</output>
    </IntentBridgeProvider>
  );
}

const meta = {
  title: "Intent/Overlays",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const logOf = (canvasElement: HTMLElement) => within(canvasElement).getByTestId("log");

export const DialogRegistersItsDialog: Story = {
  render: () => (
    <RecordingBridge>
      <Dialog defaultOpen>
        <DialogContent intent="dialog-demo" intentKey="d1">
          <DialogHeader>
            <DialogTitle>Edit booking</DialogTitle>
            <DialogDescription>Change the party size.</DialogDescription>
          </DialogHeader>
          <DialogBody>Body</DialogBody>
        </DialogContent>
      </Dialog>
    </RecordingBridge>
  ),
  play: async ({ canvasElement }) => {
    const dialog = await screen.findByRole("dialog", { name: "Edit booking" });
    await expect(dialog).toHaveAttribute("data-intent", "dialog-demo");
    await expect(dialog).toHaveAttribute("data-intent-key", "d1");
    await waitFor(() => expect(logOf(canvasElement)).toHaveTextContent("dialog-demo:d1:dialog"));
  },
};

export const AlertDialogRegistersItsAlertDialog: Story = {
  render: () => (
    <RecordingBridge>
      <AlertDialog
        defaultOpen
        intent="confirm-cancel"
        intentKey="a1"
        title="Cancel this booking?"
        onConfirm={async () => {}}
        description="The table is released."
      />
    </RecordingBridge>
  ),
  play: async ({ canvasElement }) => {
    const dialog = await screen.findByRole("alertdialog", { name: "Cancel this booking?" });
    await expect(dialog).toHaveAttribute("data-intent", "confirm-cancel");
    await waitFor(() =>
      expect(logOf(canvasElement)).toHaveTextContent("confirm-cancel:a1:alertdialog"),
    );
  },
};

export const DrawerRegistersItsDialog: Story = {
  render: () => (
    <RecordingBridge>
      <Drawer defaultOpen>
        <DrawerContent intent="drawer-demo" intentKey="w1">
          <DrawerTitle>Filters</DrawerTitle>
          <DrawerDescription>Narrow the list.</DrawerDescription>
        </DrawerContent>
      </Drawer>
    </RecordingBridge>
  ),
  play: async ({ canvasElement }) => {
    const drawer = await screen.findByRole("dialog", { name: "Filters" });
    await expect(drawer).toHaveAttribute("data-intent", "drawer-demo");
    await waitFor(() => expect(logOf(canvasElement)).toHaveTextContent("drawer-demo:w1:dialog"));
  },
};

export const PopoverRegistersItsContent: Story = {
  render: () => (
    <RecordingBridge>
      <Popover defaultOpen>
        <PopoverTrigger>Details</PopoverTrigger>
        <PopoverContent intent="popover-demo" intentKey="p1" aria-label="Details panel">
          Panel
        </PopoverContent>
      </Popover>
    </RecordingBridge>
  ),
  play: async ({ canvasElement }) => {
    const panel = await screen.findByRole("dialog", { name: "Details panel" });
    await expect(panel).toHaveAttribute("data-intent", "popover-demo");
    await waitFor(() => expect(logOf(canvasElement)).toHaveTextContent("popover-demo:p1:dialog"));
  },
};

export const DropdownMenuRegistersMenuAndItems: Story = {
  render: () => (
    <RecordingBridge>
      <DropdownMenu>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent intent="menu-demo" intentKey="m1">
          <DropdownMenuItem intent="menu-item" intentKey="i1">
            Rename
          </DropdownMenuItem>
          <DropdownMenuCheckboxItem checked intent="menu-check" intentKey="c1">
            Pinned
          </DropdownMenuCheckboxItem>
          <DropdownMenuRadioGroup value="a">
            <DropdownMenuRadioItem value="a" intent="menu-radio" intentKey="r1">
              Sort by name
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger intent="menu-sub" intentKey="s1">
              More
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Archive</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    </RecordingBridge>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Actions" }));
    const menu = await screen.findByRole("menu", { name: "Actions" });
    await expect(menu).toHaveAttribute("data-intent", "menu-demo");
    await expect(screen.getByRole("menuitem", { name: "Rename" })).toHaveAttribute(
      "data-intent-key",
      "i1",
    );
    await expect(screen.getByRole("menuitemcheckbox", { name: "Pinned" })).toHaveAttribute(
      "data-intent",
      "menu-check",
    );
    await expect(screen.getByRole("menuitemradio", { name: "Sort by name" })).toHaveAttribute(
      "data-intent",
      "menu-radio",
    );
    await expect(screen.getByRole("menuitem", { name: "More" })).toHaveAttribute(
      "data-intent",
      "menu-sub",
    );
    await waitFor(() => {
      const log = logOf(canvasElement);
      expect(log).toHaveTextContent("menu-demo:m1:menu");
      expect(log).toHaveTextContent("menu-item:i1:menuitem");
      expect(log).toHaveTextContent("menu-check:c1:menuitemcheckbox");
      expect(log).toHaveTextContent("menu-radio:r1:menuitemradio");
      expect(log).toHaveTextContent("menu-sub:s1:menuitem");
    });
  },
};

export const ContextMenuRegistersTriggerMenuAndItems: Story = {
  render: () => (
    <RecordingBridge>
      <ContextMenu defaultOpen position={{ x: 40, y: 40 }}>
        <ContextMenuTrigger intent="ctx-area" intentKey="t1">
          Right-click area
        </ContextMenuTrigger>
        <ContextMenuContent intent="ctx-menu" intentKey="x1" aria-label="Row actions">
          <ContextMenuItem intent="ctx-item" intentKey="i1">
            Duplicate
          </ContextMenuItem>
          <ContextMenuCheckboxItem checked intent="ctx-check" intentKey="c1">
            Starred
          </ContextMenuCheckboxItem>
        </ContextMenuContent>
      </ContextMenu>
    </RecordingBridge>
  ),
  play: async ({ canvasElement }) => {
    const menu = await screen.findByRole("menu", { name: "Row actions" });
    await expect(menu).toHaveAttribute("data-intent", "ctx-menu");
    await expect(screen.getByRole("menuitem", { name: "Duplicate" })).toHaveAttribute(
      "data-intent",
      "ctx-item",
    );
    await expect(screen.getByRole("menuitemcheckbox", { name: "Starred" })).toHaveAttribute(
      "data-intent",
      "ctx-check",
    );
    await waitFor(() => {
      const log = logOf(canvasElement);
      expect(log).toHaveTextContent("ctx-area:t1:generic");
      expect(log).toHaveTextContent("ctx-menu:x1:menu");
      expect(log).toHaveTextContent("ctx-item:i1:menuitem");
      expect(log).toHaveTextContent("ctx-check:c1:menuitemcheckbox");
    });
  },
};

export const HoverCardRegistersItsTrigger: Story = {
  render: () => (
    <RecordingBridge>
      <HoverCard>
        <HoverCardTrigger asChild intent="hover-demo" intentKey="h1">
          <a href="/guests/1">Ana Quispe</a>
        </HoverCardTrigger>
        <HoverCardContent>Regular guest</HoverCardContent>
      </HoverCard>
    </RecordingBridge>
  ),
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole("link", { name: "Ana Quispe" });
    await expect(link).toHaveAttribute("data-intent", "hover-demo");
    await waitFor(() => expect(logOf(canvasElement)).toHaveTextContent("hover-demo:h1:link"));
  },
};
