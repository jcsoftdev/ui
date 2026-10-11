// Type-checks the examples in site/src/content/docs/docs/primitives.md against the built package.
// Every ```tsx block in that page must equal one `#region` below (see test/docs-examples.mjs).
// Run after `pnpm build`: pnpm check:docs-examples
import {
  CommandPrimitive,
  type CommandFilter,
  commandScore,
  computePlacement,
  DialogPrimitive,
  LAYER_BRANCH_ATTRIBUTE,
  MenuPrimitive,
  PopoverPrimitive,
  PopperPrimitive,
  Portal,
  useDismissableLayer,
  useFocusScope,
  useLayer,
  usePresence,
} from "@jcsoftdev/ui/primitives";
import { useRef, useState } from "react";

// #region dialog
export function ConfirmDialog() {
  return (
    <DialogPrimitive.Root>
      <DialogPrimitive.Trigger>Delete</DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="overlay" />
        <DialogPrimitive.Content className="dialog">
          <DialogPrimitive.Title>Delete this booking?</DialogPrimitive.Title>
          <DialogPrimitive.Description>This cannot be undone.</DialogPrimitive.Description>
          <DialogPrimitive.Close>Cancel</DialogPrimitive.Close>
          <DialogPrimitive.Close>Delete</DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
// #endregion

// #region popover
export function FilterPopover() {
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger>Filters</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content className="popover" side="bottom" align="start" sideOffset={6}>
          <label>
            Status <input name="status" />
          </label>
          <PopoverPrimitive.Close>Done</PopoverPrimitive.Close>
          <PopoverPrimitive.Arrow className="arrow" />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
// #endregion

// #region menu
export function ActionsMenu() {
  const [bold, setBold] = useState(false);
  return (
    <MenuPrimitive.Root>
      <MenuPrimitive.Trigger>Actions</MenuPrimitive.Trigger>
      <MenuPrimitive.Portal>
        <MenuPrimitive.Content className="menu" sideOffset={4}>
          <MenuPrimitive.Label>Booking</MenuPrimitive.Label>
          <MenuPrimitive.Item onSelect={() => console.log("edit")}>Edit</MenuPrimitive.Item>
          <MenuPrimitive.CheckboxItem checked={bold} onCheckedChange={setBold}>
            <MenuPrimitive.ItemIndicator>on</MenuPrimitive.ItemIndicator>
            Highlight
          </MenuPrimitive.CheckboxItem>
          <MenuPrimitive.Separator />
          <MenuPrimitive.Sub>
            <MenuPrimitive.SubTrigger>Move to</MenuPrimitive.SubTrigger>
            <MenuPrimitive.Portal>
              <MenuPrimitive.SubContent className="menu">
                <MenuPrimitive.Item>Tomorrow</MenuPrimitive.Item>
                <MenuPrimitive.Item>Next week</MenuPrimitive.Item>
              </MenuPrimitive.SubContent>
            </MenuPrimitive.Portal>
          </MenuPrimitive.Sub>
        </MenuPrimitive.Content>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  );
}
// #endregion

// #region command
export function ServicePicker({ onPick }: { onPick: (service: string) => void }) {
  return (
    <CommandPrimitive.Root label="Services">
      <CommandPrimitive.Input placeholder="Search services" />
      <CommandPrimitive.List>
        <CommandPrimitive.Empty>No results.</CommandPrimitive.Empty>
        <CommandPrimitive.Group heading="Hair">
          <CommandPrimitive.Item value="Haircut" keywords={["cut"]} onSelect={onPick}>
            Haircut
          </CommandPrimitive.Item>
          <CommandPrimitive.Item value="Beard trim" onSelect={onPick}>
            Beard trim
          </CommandPrimitive.Item>
        </CommandPrimitive.Group>
      </CommandPrimitive.List>
    </CommandPrimitive.Root>
  );
}
// #endregion

// #region command-dialog
export function CommandMenu() {
  const [open, setOpen] = useState(false);
  return (
    <CommandPrimitive.Dialog open={open} onOpenChange={setOpen} label="Command menu">
      <CommandPrimitive.Input placeholder="Type a command" />
      <CommandPrimitive.List>
        <CommandPrimitive.Empty>No results.</CommandPrimitive.Empty>
        <CommandPrimitive.Item onSelect={() => setOpen(false)}>New booking</CommandPrimitive.Item>
      </CommandPrimitive.List>
    </CommandPrimitive.Dialog>
  );
}
// #endregion

// #region popper
export function Tooltipish() {
  return (
    <PopperPrimitive.Root>
      <PopperPrimitive.Anchor>Anchor</PopperPrimitive.Anchor>
      <Portal>
        <PopperPrimitive.Content
          side="top"
          sideOffset={8}
          style={{ maxHeight: "var(--ui-popper-available-height)" }}
        >
          Hint
          <PopperPrimitive.Arrow />
        </PopperPrimitive.Content>
      </Portal>
    </PopperPrimitive.Root>
  );
}
// #endregion

// #region hooks
export function CustomLayer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const mounted = usePresence(open, ref);
  const isTop = useLayer(open);
  useFocusScope({ ref, active: open, trapped: true, isTop });
  const { onPointerDownCapture, onFocusCapture, onBlurCapture } = useDismissableLayer({
    ref,
    active: open,
    isTop,
    onDismiss: onClose,
  });
  if (!mounted) return null;
  return (
    <Portal>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        data-state={open ? "open" : "closed"}
        onPointerDownCapture={onPointerDownCapture}
        onFocusCapture={onFocusCapture}
        onBlurCapture={onBlurCapture}
      >
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </Portal>
  );
}
// #endregion

// #region pure
const byPrefix: CommandFilter = (value, search) => (value.startsWith(search) ? 1 : 0);
export const score = commandScore("Haircut", "hc");
export const placement = computePlacement;
export const branch = { [LAYER_BRANCH_ATTRIBUTE]: "" };
export const filter = byPrefix;
// #endregion
