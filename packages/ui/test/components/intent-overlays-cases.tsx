import { renderToStaticMarkup } from "react-dom/server";
import { AlertDialog } from "../../src/overlays/alert-dialog/alert-dialog.js";
import { ContextMenu, ContextMenuTrigger } from "../../src/overlays/context-menu/context-menu.js";
import { Dialog, DialogContent, DialogTitle } from "../../src/overlays/dialog/dialog.js";
import { Drawer, DrawerContent, DrawerTitle } from "../../src/overlays/drawer/drawer.js";
import { DropdownMenu, DropdownMenuContent } from "../../src/overlays/dropdown-menu/dropdown-menu.js";
import { HoverCard, HoverCardTrigger } from "../../src/overlays/hover-card/hover-card.js";
import { Popover, PopoverContent } from "../../src/overlays/popover/popover.js";

const probe = { intent: "probe", intentKey: "k1" };

export const html = {
  contextMenuTrigger: () =>
    renderToStaticMarkup(
      <ContextMenu>
        <ContextMenuTrigger {...probe}>area</ContextMenuTrigger>
      </ContextMenu>,
    ),
  hoverCardTrigger: () =>
    renderToStaticMarkup(
      <HoverCard>
        <HoverCardTrigger {...probe}>who</HoverCardTrigger>
      </HoverCard>,
    ),
  hoverCardTriggerAsChild: () =>
    renderToStaticMarkup(
      <HoverCard>
        <HoverCardTrigger asChild {...probe}>
          <a href="/x">who</a>
        </HoverCardTrigger>
      </HoverCard>,
    ),
  hoverCardTriggerEmptyIntent: () =>
    renderToStaticMarkup(
      <HoverCard>
        <HoverCardTrigger intent="" intentKey="k1">
          who
        </HoverCardTrigger>
      </HoverCard>,
    ),
  portalled: () =>
    renderToStaticMarkup(
      <>
        <Dialog open>
          <DialogContent {...probe}>
            <DialogTitle>t</DialogTitle>
          </DialogContent>
        </Dialog>
        <Drawer open>
          <DrawerContent {...probe}>
            <DrawerTitle>t</DrawerTitle>
          </DrawerContent>
        </Drawer>
        <AlertDialog open title="t" {...probe} />
        <Popover open>
          <PopoverContent {...probe} />
        </Popover>
        <DropdownMenu open>
          <DropdownMenuContent {...probe} />
        </DropdownMenu>
      </>,
    ),
};
