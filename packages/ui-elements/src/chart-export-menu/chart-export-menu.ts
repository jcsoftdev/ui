import { bindMenuTrigger, createMenuContent, type MenuContent } from "@jcsoftdev/ui-core/menu";
import { autoPosition } from "@jcsoftdev/ui-core/popper";
import {
  adoptStyles,
  type DefineOptions,
  defineElement,
  ElementBase,
  emit,
  hasPopover,
  rootOf,
  uid,
} from "../internal/base.js";
import { bindChart, type ChartHost } from "../internal/chart-protocol.js";
import css from "./chart-export-menu.css.js";

export type ExportFormat = "svg" | "png" | "csv" | "xlsx";

export interface ExportTexts {
  /** Name of the trigger and the menu. */
  export: string;
  svg: string;
  png: string;
  csv: string;
  xlsx: string;
}

const DEFAULT_TEXTS: ExportTexts = {
  export: "Export",
  svg: "SVG",
  png: "PNG",
  csv: "CSV",
  xlsx: "XLSX",
};
const ALL: readonly ExportFormat[] = ["svg", "png", "csv", "xlsx"];

/**
 * `<ui-chart-export-menu>`: a menu button that downloads the chart it sits in (or the one `for`
 * names) as SVG, PNG, CSV or XLSX. WAI-ARIA menu button on the ui-core `menu` behaviour: Enter,
 * Space and ArrowDown open it, arrows and typeahead move, Enter chooses, Escape closes and returns
 * focus to the button. The popup is a Popover API element placed with ui-core's `autoPosition`.
 * Nothing is loaded up front: the SVG/PNG/CSV writer is fetched on the first export and the XLSX
 * writer only when XLSX is chosen.
 * Attributes: `for` (chart id), `formats` (space separated subset, default all four), `filename`
 * (default: the chart title). Property: `texts` (visible strings, English defaults). Fires
 * `export` (`detail: { format, dropped }`, `dropped` lists external `<image>` hrefs an SVG/PNG could not include) after a download starts and `exporterror` (`detail: { format,
 * error }`) if one fails.
 */
export class UiChartExportMenu extends ElementBase {
  static observedAttributes = ["for", "formats"];
  texts: Partial<ExportTexts> = {};
  #chart: ChartHost | undefined;
  #unbind: (() => void) | undefined;
  #content: MenuContent | undefined;
  #stopTrigger: (() => void) | undefined;
  #stopPosition: (() => void) | undefined;
  #stopDismiss: (() => void) | undefined;
  readonly #trigger = document.createElement("button");
  readonly #menu = document.createElement("div");

  constructor() {
    super();
    this.#trigger.type = "button";
    this.#trigger.dataset.uiPart = "trigger";
    this.#trigger.setAttribute("aria-haspopup", "menu");
    this.#trigger.setAttribute("aria-expanded", "false");
    this.#menu.dataset.uiPart = "menu";
    this.#menu.setAttribute("role", "menu");
    this.#menu.id = uid("export-menu");
    this.#trigger.setAttribute("aria-controls", this.#menu.id);
  }

  get open(): boolean {
    return hasPopover() ? this.#menu.matches(":popover-open") : !this.#menu.hidden;
  }

  connectedCallback(): void {
    this.dataset.ui = "chart-export-menu";
    adoptStyles(rootOf(this), css);
    this.#build();
    this.append(this.#trigger, this.#menu);
    this.#content = createMenuContent(this.#menu, {
      onSelect: (item) => {
        this.#setOpen(false, "none");
        void this.#export(item.dataset.format as ExportFormat);
      },
      onTab: () => this.#setOpen(false, "none", false),
    });
    this.#stopTrigger = bindMenuTrigger(this.#trigger, {
      isOpen: () => this.open,
      setOpen: (open, intent) => this.#setOpen(open, intent),
    });
    this.#menu.addEventListener("toggle", this.#onToggle);
    this.#bind();
  }

  disconnectedCallback(): void {
    this.#unbind?.();
    this.#stopTrigger?.();
    this.#content?.destroy();
    this.#stopPosition?.();
    this.#stopDismiss?.();
    this.#menu.removeEventListener("toggle", this.#onToggle);
  }

  attributeChangedCallback(): void {
    if (!this.isConnected) return;
    this.#unbind?.();
    this.#bind();
    this.#build();
  }

  #bind(): void {
    this.#unbind = bindChart(this, (chart) => {
      this.#chart = chart;
      return () => {
        this.#chart = undefined;
      };
    });
  }

  #formats(): ExportFormat[] {
    const wanted = this.getAttribute("formats")?.split(/\s+/);
    return wanted ? ALL.filter((format) => wanted.includes(format)) : [...ALL];
  }

  #build(): void {
    const texts = { ...DEFAULT_TEXTS, ...this.texts };
    this.#trigger.textContent = texts.export;
    this.#menu.setAttribute("aria-label", texts.export);
    if (hasPopover()) this.#menu.setAttribute("popover", "auto");
    else this.#menu.hidden = true;
    this.#menu.replaceChildren(
      ...this.#formats().map((format) => {
        const item = document.createElement("button");
        item.type = "button";
        item.setAttribute("role", "menuitem");
        item.tabIndex = -1;
        item.dataset.format = format;
        item.textContent = texts[format];
        return item;
      }),
    );
  }

  readonly #onToggle = (event: Event) => {
    const open = (event as ToggleEvent).newState === "open";
    this.#trigger.setAttribute("aria-expanded", `${open}`);
    if (!open) {
      this.#stopPosition?.();
      // Light dismiss (Escape, outside press) hides the popover natively; if focus was left inside
      // it or dropped, it returns to the button. A press on another control keeps its focus.
      const active = document.activeElement;
      if (!active || active === document.body || this.#menu.contains(active))
        this.#trigger.focus({ preventScroll: true });
    }
  };

  #place(): void {
    this.#stopPosition?.();
    this.#stopPosition = autoPosition(this.#trigger, this.#menu, {
      side: "bottom",
      align: "end",
      sideOffset: 4,
      collisionPadding: 8,
    });
  }

  #setOpen(open: boolean, intent: "first" | "last" | "none", restoreFocus = true): void {
    if (open === this.open) return;
    if (hasPopover()) {
      if (open) {
        this.#menu.showPopover();
        // Placed before anything can run: an unplaced popup sits at the page corner, and a pointer
        // there would see the menu move away from under it (and steal the keyboard focus).
        this.#place();
      } else this.#menu.hidePopover();
    } else {
      this.#menu.hidden = !open;
      this.#trigger.setAttribute("aria-expanded", `${open}`);
      this.#stopDismiss?.();
      if (open) {
        this.#place();
        const away = (event: Event) => {
          if (!this.contains(event.target as Node)) this.#setOpen(false, "none", false);
        };
        const onEscape = (event: KeyboardEvent) =>
          event.key === "Escape" && this.#setOpen(false, "none");
        document.addEventListener("pointerdown", away, true);
        document.addEventListener("keydown", onEscape, true);
        this.#stopDismiss = () => {
          document.removeEventListener("pointerdown", away, true);
          document.removeEventListener("keydown", onEscape, true);
        };
      } else this.#stopPosition?.();
    }
    if (open) this.#content?.focusEntry(intent);
    else if (restoreFocus) this.#trigger.focus({ preventScroll: true });
  }

  async #export(format: ExportFormat): Promise<void> {
    const chart = this.#chart;
    if (!chart) return;
    let dropped: string[] = [];
    try {
      const tools = await import("../internal/chart-export.js");
      const snapshot = chart.chartSnapshot;
      const fileName = tools.exportFileName(
        this.getAttribute("filename") ?? snapshot?.title ?? "chart",
        format,
      );
      if (format === "svg" || format === "png") {
        const svgs = chart.exportSvgs();
        if (svgs.length === 0) return;
        const options = { fileName, from: chart };
        dropped =
          format === "svg"
            ? tools.downloadSvg(svgs, options)
            : await tools.downloadPng(svgs, { ...options, layer: chart.canvasLayer });
        if (dropped.length)
          console.warn(`ui-chart-export-menu: left out external images: ${dropped.join(", ")}`);
      } else if (snapshot) {
        if (format === "csv") tools.downloadCsv(snapshot, fileName);
        else await tools.downloadXlsx(snapshot, fileName);
      } else return;
      emit(this, "export", { format, dropped });
    } catch (error) {
      emit(this, "exporterror", { format, error });
    }
  }
}

/** Registers `<ui-chart-export-menu>` (or `<prefix>-chart-export-menu`) and returns the tag. */
export function defineChartExportMenu(options?: DefineOptions): string {
  return defineElement("chart-export-menu", UiChartExportMenu, options);
}
