import {
  computePinOffsets,
  type PinnedColumns,
  type PinSide,
  parseStoredPins,
  sanitizePinned,
  setColumnPin,
} from "@jcsoftdev/ui-core/column-pin";
import { observeResize } from "@jcsoftdev/ui-core/observe/resize";
import { type DefineOptions, defineElement, ElementBase, emit } from "../internal/base.js";
import { connectLight } from "../internal/containers.js";
import { icon, part } from "../internal/e10.js";
import css from "./table.css.js";

const LEFT = icon('<path d="M3 19V5"/><path d="m13 6-6 6 6 6"/><path d="M7 12h14"/>', 14);
const RIGHT = icon('<path d="M17 12H3"/><path d="m11 18 6-6-6-6"/><path d="M21 5v14"/>', 14);
const UNPIN = icon(
  '<path d="M12 17v5"/><path d="M15 9.34V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H7.89"/><path d="m2 2 20 20"/><path d="M9 9v1.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h11"/>',
  14,
);

const ids = (value: string | null): string[] =>
  (value ?? "").split(/[\s,]+/).filter((id) => id.length > 0);

const same = (a: PinnedColumns, b: PinnedColumns) =>
  JSON.stringify([a.left ?? [], a.right ?? []]) === JSON.stringify([b.left ?? [], b.right ?? []]);

/**
 * `<ui-table>`: a native, semantic `<table>` (put it inside) in its own horizontal scroll wrapper,
 * with the kit's look and optional sticky column pinning. There is no ARIA to add: the table, its
 * `<caption>`, `<th scope>` and cells are the platform's. This is the plain table, not the data grid.
 *
 * Markup helpers (attributes on the native cells): `data-column-id` on a header cell and on that
 * column's cells identifies a column; `pinnable` on a `<th>` adds pin buttons to it;
 * `data-align="end"` right-aligns a column; `data-selected="true"` or `aria-selected="true"` on a
 * `<tr>` highlights a row. A link row is a `<tr>` whose first cell holds `<a data-row-link href>`:
 * the link's click area stretches over the whole row.
 *
 * Pinning: pinned columns stay sticky at the left or right edge while the rest scrolls, with an
 * edge shadow once the table is scrolled. The buttons are `aria-pressed` toggles named by the
 * `label-*` attributes. Attributes `pinned-left` / `pinned-right` (space or comma separated column
 * ids) control the pins (the `pinnedColumns` property does too): the table then only reports the
 * user's choice and you update them. Without them the table keeps the pins itself, restored from
 * and saved to `localStorage` under `pin-storage-key`. `label-pin-left` ("Fijar a la izquierda"),
 * `label-pin-right` ("Fijar a la derecha"), `label-unpin` ("Desfijar").
 * Events: `pinchange` (bubbles) with `detail: { left, right }`.
 */
export class UiTable extends ElementBase {
  static observedAttributes = [
    "pinned-left",
    "pinned-right",
    "label-pin-left",
    "label-pin-right",
    "label-unpin",
  ];

  #controlled: PinnedColumns | undefined;
  #internal: PinnedColumns = {};
  #known: string[] = [];
  #scrolled = { start: false, end: false };
  #cleanups: Array<() => void> = [];
  #observed: Element[] = [];
  #mutation: MutationObserver | undefined;
  #frame = 0;

  /** Controlled pins; setting it makes the table controlled, `undefined` hands control back. */
  get pinnedColumns(): { left: string[]; right: string[] } {
    return sanitizePinned(this.#source(), this.#known.length ? this.#known : null);
  }

  set pinnedColumns(value: PinnedColumns | undefined) {
    this.#controlled = value;
    this.#schedule();
  }

  connectedCallback(): void {
    connectLight(this, "table", css);
    const key = this.getAttribute("pin-storage-key");
    if (key && !this.#isControlled()) {
      const stored = parseStoredPins(read(key));
      if (stored) this.#internal = stored;
    }
    this.addEventListener("scroll", this.#onScroll, { passive: true });
    this.addEventListener("click", this.#onClick);
    this.#mutation = new MutationObserver(() => this.#schedule());
    this.#mutation.observe(this, { childList: true, subtree: true });
    this.#measure();
  }

  disconnectedCallback(): void {
    this.removeEventListener("scroll", this.#onScroll);
    this.removeEventListener("click", this.#onClick);
    this.#mutation?.disconnect();
    for (const stop of this.#cleanups) stop();
    this.#cleanups = [];
    this.#observed = [];
    cancelAnimationFrame(this.#frame);
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.#schedule();
  }

  /** Pins a column to a side, or unpins it with `null`, as the buttons do. */
  pin(columnId: string, side: PinSide | null): void {
    const current = sanitizePinned(this.#source(), this.#known);
    const next = setColumnPin(current, columnId, side, this.#known);
    if (same(next, current)) return;
    if (!this.#isControlled()) {
      this.#internal = next;
      const key = this.getAttribute("pin-storage-key");
      if (key) write(key, JSON.stringify(next));
    }
    emit(this, "pinchange", next);
    this.#measure();
  }

  #isControlled(): boolean {
    return (
      this.#controlled !== undefined ||
      this.hasAttribute("pinned-left") ||
      this.hasAttribute("pinned-right")
    );
  }

  #source(): PinnedColumns {
    if (this.#controlled) return this.#controlled;
    if (this.#isControlled())
      return {
        left: ids(this.getAttribute("pinned-left")),
        right: ids(this.getAttribute("pinned-right")),
      };
    return this.#internal;
  }

  readonly #onScroll = (): void => this.#measure();

  readonly #onClick = (event: Event): void => {
    const button = (event.target as Element | null)?.closest<HTMLElement>("button[data-pin]");
    const id = button?.closest<HTMLElement>("[data-column-id]")?.dataset.columnId;
    if (!button || !id) return;
    const side = button.dataset.pin;
    this.pin(id, side === "left" || side === "right" ? side : null);
  };

  #schedule(): void {
    cancelAnimationFrame(this.#frame);
    this.#frame = requestAnimationFrame(() => this.#measure());
  }

  #observe(headers: Element[]): void {
    if (
      headers.length === this.#observed.length &&
      headers.every((h, i) => h === this.#observed[i])
    )
      return;
    for (const stop of this.#cleanups) stop();
    this.#observed = headers;
    const table = this.querySelector("table");
    this.#cleanups = [this, ...(table ? [table] : []), ...headers].map((element) =>
      observeResize(element, () => this.#schedule()),
    );
  }

  #measure(): void {
    const headers = Array.from(this.querySelectorAll<HTMLElement>("thead [data-column-id]"));
    this.#observe(headers);
    const widths: Record<string, number> = {};
    this.#known = [];
    for (const header of headers) {
      const id = header.dataset.columnId;
      if (!id) continue;
      this.#known.push(id);
      widths[id] = header.getBoundingClientRect().width;
    }
    this.#scrolled = {
      start: this.scrollLeft > 0,
      end: this.scrollLeft + this.clientWidth < this.scrollWidth - 1,
    };
    const positions = computePinOffsets(widths, sanitizePinned(this.#source(), this.#known));
    for (const cell of this.querySelectorAll<HTMLElement>("[data-column-id]")) {
      const position = positions[cell.dataset.columnId ?? ""];
      if (!position) {
        cell.removeAttribute("data-pinned");
        cell.removeAttribute("data-pin-shadow");
        cell.style.removeProperty("left");
        cell.style.removeProperty("right");
        continue;
      }
      const other = position.side === "left" ? "right" : "left";
      cell.dataset.pinned = position.side;
      cell.style.removeProperty(other);
      cell.style.setProperty(position.side, `${position.offset}px`);
      const shadow =
        position.edge && (position.side === "left" ? this.#scrolled.start : this.#scrolled.end);
      cell.toggleAttribute("data-pin-shadow", shadow);
    }
    for (const header of this.querySelectorAll<HTMLElement>("th[pinnable][data-column-id]"))
      this.#buttons(header, positions[header.dataset.columnId ?? ""]?.side);
  }

  #buttons(header: HTMLElement, side: PinSide | undefined): void {
    let holder = header.querySelector<HTMLElement>(":scope > [data-ui-part=pin]");
    const left = this.getAttribute("label-pin-left") ?? "Fijar a la izquierda";
    const right = this.getAttribute("label-pin-right") ?? "Fijar a la derecha";
    const unpin = this.getAttribute("label-unpin") ?? "Desfijar";
    const state = `${side ?? ""}|${left}|${right}|${unpin}`;
    if (holder?.dataset.state === state) return;
    if (!holder) {
      holder = part("span", "pin");
      header.append(holder);
    }
    const focused = holder.contains((header.getRootNode() as Document | ShadowRoot).activeElement);
    holder.dataset.state = state;
    const make = (kind: string, label: string, svg: string, pressed: boolean) => {
      const button = part("button", "pin-button");
      button.type = "button";
      button.dataset.pin = kind;
      button.setAttribute("aria-pressed", String(pressed));
      button.setAttribute("aria-label", label);
      button.title = label;
      button.innerHTML = svg;
      return button;
    };
    const buttons = side
      ? [make("none", unpin, UNPIN, true)]
      : [make("left", left, LEFT, false), make("right", right, RIGHT, false)];
    holder.replaceChildren(...buttons);
    if (focused) buttons[0]?.focus();
  }
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be blocked (private mode, quota); pins just stop persisting.
  }
}

/** Registers `<ui-table>` (or the same under another prefix) and returns its tag. */
export function defineTable(options?: DefineOptions): string {
  return defineElement("table", UiTable, options);
}
