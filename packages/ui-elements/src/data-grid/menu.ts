import type { GridColumn } from "@jcsoftdev/ui-core/grid/model";
import type { GridZone } from "@jcsoftdev/ui-core/grid/pin";
import type { GridLabels } from "./data-grid.js";

export interface ColumnMenuOptions {
  anchor: HTMLElement;
  // biome-ignore lint/suspicious/noExplicitAny: rows are whatever the consumer passes.
  column: GridColumn<any>;
  labels: GridLabels;
  sort: "ascending" | "descending" | undefined;
  zone: GridZone;
  rtl: boolean;
  sortBy: (direction: "asc" | "desc" | null) => void;
  pin: (side: "left" | "right" | null) => void;
  restoreFocus: () => void;
}

/**
 * The per-column menu (sort, pin), built on first use. A native `popover="auto"` in the top layer:
 * light dismiss and Escape come from the platform, arrows move between the items and focus returns
 * to the header when it closes. Items honour `--touch-target`.
 */
export function openColumnMenu(host: HTMLElement, options: ColumnMenuOptions): void {
  const { column, labels, zone } = options;
  host.querySelector("[data-ui-part=menu]")?.remove();
  const menu = document.createElement("div");
  menu.dataset.uiPart = "menu";
  menu.setAttribute("role", "menu");
  menu.setAttribute("aria-label", labels.columnMenu(column.header));
  menu.popover = "auto";
  const items: Array<[string, () => void]> = [];
  if (column.sortable !== false) {
    items.push(
      [labels.sortAsc, () => options.sortBy("asc")],
      [labels.sortDesc, () => options.sortBy("desc")],
    );
    if (options.sort) items.push([labels.clearSort, () => options.sortBy(null)]);
  }
  if (column.pinnable !== false) {
    if (zone !== "start") items.push([labels.pinStart, () => options.pin("left")]);
    if (zone !== "end") items.push([labels.pinEnd, () => options.pin("right")]);
    if (zone !== "center") items.push([labels.unpin, () => options.pin(null)]);
  }
  for (const [text, run] of items) {
    const item = document.createElement("button");
    item.type = "button";
    item.setAttribute("role", "menuitem");
    item.tabIndex = -1;
    item.textContent = text;
    item.addEventListener("click", () => {
      menu.hidePopover();
      run();
    });
    menu.append(item);
  }
  const buttons = () => [...menu.querySelectorAll<HTMLButtonElement>("button")];
  menu.addEventListener("keydown", (event) => {
    const list = buttons();
    const at = list.indexOf(document.activeElement as HTMLButtonElement);
    const move = (to: number) => {
      event.preventDefault();
      list[(to + list.length) % list.length]?.focus();
    };
    if (event.key === "ArrowDown") move(at + 1);
    else if (event.key === "ArrowUp") move(at - 1);
    else if (event.key === "Home") move(0);
    else if (event.key === "End") move(list.length - 1);
    else if (event.key === "Tab") menu.hidePopover();
  });
  menu.addEventListener("toggle", (event) => {
    if ((event as ToggleEvent).newState !== "closed") return;
    menu.remove();
    options.restoreFocus();
  });
  host.append(menu);
  menu.showPopover();
  const rect = options.anchor.getBoundingClientRect();
  const width = menu.offsetWidth;
  const left = options.rtl ? rect.right - width : rect.left;
  menu.style.insetBlockStart = `${rect.bottom}px`;
  menu.style.insetInlineStart = "auto";
  menu.style.left = `${Math.max(4, Math.min(left, innerWidth - width - 4))}px`;
  buttons()[0]?.focus();
}
