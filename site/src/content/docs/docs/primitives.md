---
title: Headless primitives
description: The unstyled behavior under every overlay - Dialog, Popover, Menu, Command and the hooks behind them - published as @jcsoftdev/ui/primitives for your own markup and styles.
section: Theming
---

The styled components (`Dialog`, `Popover`, `DropdownMenu`, `CommandPalette`...) are thin skins over a set of unstyled primitives. `@jcsoftdev/ui/primitives` publishes those primitives so you can keep the behavior and accessibility and write all the markup and styles yourself.

## Philosophy

- **No styles.** A primitive renders no Tailwind classes and no inline style except what positioning needs. It forwards props and refs, so `className`, `style`, `data-*` and event handlers go straight to the DOM node.
- **State in attributes.** Open or closed, side, alignment and highlighted items are exposed as `data-*` attributes, so CSS (or Tailwind `data-[state=open]:` variants) is enough to style every state, including enter and exit animations.
- **Compound parts.** Each primitive is a namespace of parts (`DialogPrimitive.Root`, `.Trigger`, `.Content`...). Parts that render a button or a heading take `asChild` to render your own element instead.
- **Zero dependencies.** Everything is in-house; the only peers are `react` and `react-dom` 19.

## Import

```ts
import {
  CommandPrimitive,
  DialogPrimitive,
  MenuPrimitive,
  PopoverPrimitive,
  PopperPrimitive,
} from "@jcsoftdev/ui/primitives";
```

The entry is ESM with types. Only the public set below is importable; deep paths such as `@jcsoftdev/ui/primitives/hide-others` are blocked by the package `exports` map on purpose, so internals can change without breaking you. Importing one primitive does not pull the others: `PopoverPrimitive` bundles the popper but not `DialogPrimitive`, `MenuPrimitive` or `CommandPrimitive`, and a styled-only import such as `Button` bundles no primitives at all.

| Export                                                            | What it is                                                                                                                                                |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DialogPrimitive`                                                 | Modal or non-modal dialog: Root, Trigger, Portal, Overlay, Content, Title, Description, Close.                                                            |
| `PopoverPrimitive`                                                | Anchored, dismissable panel: Root, Trigger, Anchor, Portal, Content, Close, Arrow.                                                                        |
| `PopperPrimitive`                                                 | The positioning layer under popover and menu: Root, Anchor, Content, Arrow.                                                                               |
| `MenuPrimitive`                                                   | Menu with items, checkbox and radio items, groups, labels, separators and submenus.                                                                       |
| `CommandPrimitive`                                                | Filterable command menu: Root, Input, List, Item, Group, Separator, Empty, Loading, Dialog, `useCommandState`.                                            |
| `Portal`                                                          | Renders into `container` (default `document.body`); nothing on the server.                                                                                |
| `usePresence`, `useFocusScope`, `useDismissableLayer`, `useLayer` | The hooks the primitives are made of, for building your own layers.                                                                                       |
| `LAYER_BRANCH_ATTRIBUTE`                                          | `"data-ui-layer-branch"`, see below.                                                                                                                      |
| `computePlacement`                                                | Pure, DOM-free placement math, plus the `Side`, `Align`, `Direction`, `Padding`, `Rect`, `Size`, `Placement`, `PlacementInput` and `ArrowGeometry` types. |
| `commandScore`, `CommandFilter`                                   | The fuzzy scorer and the type of a custom `filter`.                                                                                                       |

Prop types live on the namespaces, for example `DialogPrimitive.DialogContentProps` and `MenuPrimitive.MenuItemProps`.

## Dialog

Modal by default: focus is trapped and returned, the page is hidden from assistive technology and scroll is locked, and Escape or an outside press closes it. `Title` is required for an accessible name (a dev error is raised without one); `Description` is optional. Pass `modal={false}` for a non-modal dialog.

```tsx region=dialog
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
```

## Popover

Non-modal by default: it closes on Escape or an outside press, and Tab off its last item hands focus to the trigger's neighbour. Pass `modal` to trap focus. Positioning props (`side`, `align`, `sideOffset`, `alignOffset`, `collisionPadding`, `avoidCollisions`, `sticky`, `hideWhenDetached`) are shared with every popper-based part.

```tsx region=popover
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
```

## Menu

Items, checkbox and radio items, groups and labels, and submenus. Roving focus with Home/End and typeahead, highlight follows the pointer, and `onSelect` can call `event.preventDefault()` to keep the menu open. For a context menu, wrap an element at the pointer position in `<MenuPrimitive.Anchor asChild>` and open the menu programmatically; the styled `ContextMenu` shows the pattern.

```tsx region=menu
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
```

## Command

A filterable list with fuzzy scoring, keywords, groups that hide when empty, arrow/Home/End navigation and a live result count. `Command.Dialog` puts the same command inside a dialog; it closes on the first Escape.

```tsx region=command
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
```

```tsx region=command-dialog
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
```

## Popper

Use `PopperPrimitive` directly for tooltips, hover cards or any anchored surface. The content measures itself against the anchor and the viewport and exposes the CSS variables below.

```tsx region=popper
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
```

## Building your own layer

The hooks compose into a custom overlay: presence for exit animations, a layer registration so only the topmost layer reacts, a focus scope and Escape/outside dismissal.

```tsx region=hooks
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
```

`computePlacement`, `commandScore` and `CommandFilter` are plain functions and types, usable without React.

## Data attributes and CSS variables

| Attribute                        | Where                                                                         | Values                                                       |
| -------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `data-state`                     | Dialog, popover and menu content, overlay, trigger; checkbox/radio menu items | `open` / `closed`; `checked` / `unchecked` / `indeterminate` |
| `data-side`, `data-align`        | Popper content (popover, menu, submenu)                                       | `top` `right` `bottom` `left`; `start` `center` `end`        |
| `data-highlighted`               | Menu items                                                                    | present while the item has focus or the pointer              |
| `data-selected`, `data-disabled` | Command items                                                                 | present-only; `aria-selected` mirrors `data-selected`        |
| `data-disabled`                  | Menu items                                                                    | present-only                                                 |
| `data-ui-popper-wrapper`         | The fixed positioning wrapper around popper content                           | present                                                      |
| `data-ui-command-*`              | Command parts (`-group-heading`, `-overlay`, `-dialog`, `-loading`...)        | present                                                      |
| `data-ui-layer-branch`           | Any element you mark                                                          | see below                                                    |
| `data-ui-overlay-ignore`         | Any element you mark                                                          | skipped by the modal hiding and by the focus trap            |

| Variable                                                      | Set on         | Meaning                                                                                                  |
| ------------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------- |
| `--ui-popper-available-width`, `--ui-popper-available-height` | Popper content | Space left between the anchor and the boundary on the chosen side. Use for `max-height` and `max-width`. |
| `--ui-popper-anchor-width`, `--ui-popper-anchor-height`       | Popper content | Size of the anchor. Use for `min-width: var(--ui-popper-anchor-width)`.                                  |
| `--ui-popper-transform-origin`                                | Popper content | Origin for scale animations that grow out of the anchor.                                                 |
| `--ui-command-list-height`                                    | Command list   | Measured height of the list, for animating its size.                                                     |

### Layer branches

Mark an element that lives outside a layer but belongs to the page's chrome (a toast region, a floating help button) with the `LAYER_BRANCH_ATTRIBUTE` attribute. A press or focus landing inside it never counts as an outside interaction, so it does not dismiss open dialogs, popovers or menus. The kit's `Toaster` region carries it. Add `data-ui-overlay-ignore` as well when the element must stay reachable while a modal hides the rest of the page.

## Focus and dismissal behavior

- Escape closes only the topmost layer. An open command palette with a query to clear claims the first Escape, and the second closes the surrounding dialog. A submenu closes one level per Escape.
- Opening a layer from another (a dialog from a menu item, a popover in a dialog) works; focus returns to the trigger unless something else took it.
- Menus always loop around at the ends; there is no `loop` prop. Tab closes a menu and moves focus to the next tabbable element after the trigger (Shift+Tab to the trigger).
- A non-modal popover hands focus to the trigger's neighbour on Tab off its last tabbable element, and closes.
- `aria-controls` on triggers is present only while the content is open. `aria-labelledby` and `aria-describedby` on dialogs are always rendered; pass `aria-describedby={undefined}` to opt out.
- A controlled `Command.Input` should clear its query when `onValueChange("")` fires; if it ignores it, the next Escape closes the surrounding dialog.

## Known limitations

- **Late nodes stay visible.** The modal hiding (`aria-hidden` and `inert` on siblings) runs once when the layer opens. Nodes appended to `body` after that are not hidden, and a foreign script that removes and re-adds `aria-hidden` during a modal has it cleared on release.
- **Live regions stay reachable.** Elements with `aria-live` (other than `off`) and `data-ui-overlay-ignore` are never hidden, so toasts remain announced and reachable under a modal.
- **Toaster `dir` and `container` are read once.** To follow a changing container, pass it from state: `ref={setContainer}`.
- **Scroll lock after pinch.** A touch pan that continues after a pinch is not cancelled until the next touch starts.
- **Command ordering.** Registration order is the tie-break and the restore order: an item inserted mid-list while a search is active returns to the end when the search clears. An item without `value` takes its text content once visible.
- **Command `Loading` and `Separator`.** Render `Loading` beside `List` (inside it, axe reports `aria-required-children`); `Separator` is `aria-hidden` instead of `role="separator"` for the same reason.
- **Popper tracking.** The popper repositions on resize, scroll and size changes of the anchor and content; it does not observe layout shifts that change neither.
