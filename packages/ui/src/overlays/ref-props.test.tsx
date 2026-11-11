import { createRef } from "react";
import {
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "./context-menu/context-menu.js";
import {
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog/dialog.js";
import { DrawerDescription, DrawerTitle } from "./drawer/drawer.js";
import { DropdownMenuLabel, DropdownMenuSeparator } from "./dropdown-menu/dropdown-menu.js";
import { HoverCardTrigger } from "./hover-card/hover-card.js";

const div = createRef<HTMLDivElement>();
const span = createRef<HTMLSpanElement>();
const heading = createRef<HTMLHeadingElement>();
const paragraph = createRef<HTMLParagraphElement>();

export const refProps = [
  <ContextMenuTrigger key="trigger" ref={div} intent="open" intentKey="1" />,
  <ContextMenuLabel key="label" ref={div} />,
  <ContextMenuSeparator key="separator" ref={div} />,
  <ContextMenuShortcut key="shortcut" ref={span} />,
  <DialogHeader key="header" ref={div} />,
  <DialogTitle key="title" ref={heading} />,
  <DialogDescription key="description" ref={paragraph} />,
  <DialogBody key="body" ref={div} />,
  <DialogFooter key="footer" ref={div} />,
  <DrawerTitle key="drawer-title" ref={heading} />,
  <DrawerDescription key="drawer-description" ref={paragraph} />,
  <DropdownMenuLabel key="dropdown-label" ref={div} />,
  <DropdownMenuSeparator key="dropdown-separator" ref={div} />,
  <HoverCardTrigger key="hover" ref={span} intent="peek" intentKey="1" />,
];
