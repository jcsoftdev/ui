/**
 * `HTMLElement` where it exists, an inert class elsewhere: importing an element module during SSR
 * (Node, no DOM) defines nothing and throws nothing.
 */
export const ElementBase = (
  typeof HTMLElement === "undefined" ? class {} : HTMLElement
) as typeof HTMLElement;

export interface DefineOptions {
  /** Tag prefix: `"ui"` registers `ui-button`, `"acme"` registers `acme-button`. Default `"ui"`. */
  prefix?: string;
}

/**
 * Registers `ctor` as `<prefix>-<name>` (a fresh subclass per tag, so one class can live under
 * several prefixes). Returns the tag. A tag that is already defined is left as it is.
 */
export function defineElement(
  name: string,
  ctor: CustomElementConstructor,
  { prefix = "ui" }: DefineOptions = {},
): string {
  const tag = `${prefix}-${name}`;
  if (typeof customElements === "undefined" || customElements.get(tag)) return tag;
  customElements.define(tag, class extends (ctor as typeof HTMLElement) {});
  return tag;
}

const sheets = new Map<string, CSSStyleSheet>();

/**
 * Adopts `css` into a shadow root or into the root node of a light-DOM element (the document, or
 * the shadow root it lives in), once per root. Falls back to a `<style>` element.
 */
export function adoptStyles(root: Document | ShadowRoot, css: string): void {
  if (
    "adoptedStyleSheets" in root &&
    typeof CSSStyleSheet === "function" &&
    "replaceSync" in CSSStyleSheet.prototype
  ) {
    let sheet = sheets.get(css);
    if (!sheet) {
      sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      sheets.set(css, sheet);
    }
    if (!root.adoptedStyleSheets.includes(sheet))
      root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
    return;
  }
  const parent = root instanceof Document ? root.head : root;
  const id = `ui-css-${css.length}-${css.slice(0, 24)}`;
  for (const style of parent.querySelectorAll("style[data-ui-css]"))
    if (style.getAttribute("data-ui-css") === id) return;
  const style = document.createElement("style");
  style.setAttribute("data-ui-css", id);
  style.textContent = css;
  parent.append(style);
}

/** The document or shadow root an element lives in. */
export const rootOf = (element: Node): Document | ShadowRoot => {
  const root = element.getRootNode();
  return root instanceof ShadowRoot ? root : document;
};

let counter = 0;
/** A page-unique id for ARIA wiring. */
export const uid = (part: string) => `ui-${part}-${++counter}`;

/** Gives `element` an id if it has none, and returns it. */
export function ensureId(element: Element, part: string): string {
  if (!element.id) element.id = uid(part);
  return element.id;
}

/** Whether `element` is a part of a composite (`<x-tab>` for part `tab`), whatever the prefix. */
export const isPart = (element: Element, part: string) => element.localName.endsWith(`-${part}`);

/** Boolean attribute helper. */
export function toggleAttr(element: Element, name: string, on: boolean): void {
  if (on) element.setAttribute(name, "");
  else element.removeAttribute(name);
}

/** Dispatches a bubbling, composed event (`change`, `open`...). Returns false when it was cancelled. */
export function emit(
  element: Element,
  type: string,
  detail?: unknown,
  cancelable = false,
): boolean {
  return element.dispatchEvent(
    new CustomEvent(type, { bubbles: true, composed: true, cancelable, detail }),
  );
}

/** The `command` event of Invoker Commands (`<button commandfor="id" command="--open">`). */
export type CommandEventLike = Event & { command?: string };

let commandPolyfill = false;
/**
 * Calls `handler` with the command name when an invoker (`<button commandfor="id" command="--open">`)
 * targets `host`. Browsers without Invoker Commands get a one-time click listener that dispatches
 * the same `command` event.
 */
export function onCommand(host: HTMLElement, handler: (command: string) => void): void {
  host.addEventListener("command", (event) => handler((event as CommandEventLike).command ?? ""));
  if (commandPolyfill || typeof HTMLButtonElement === "undefined") return;
  if ("commandForElement" in HTMLButtonElement.prototype) return;
  commandPolyfill = true;
  document.addEventListener("click", (event) => {
    const invoker = (event.target as Element | null)?.closest?.("button[commandfor]");
    if (!invoker || (invoker as HTMLButtonElement).disabled) return;
    const root = invoker.getRootNode() as Document | ShadowRoot;
    const target = root.getElementById?.(invoker.getAttribute("commandfor") ?? "");
    const command = invoker.getAttribute("command");
    if (!target || !command) return;
    target.dispatchEvent(Object.assign(new Event("command", { cancelable: true }), { command }));
  });
}

let locks = 0;
let previousOverflow = "";
/** Locks page scroll while at least one caller holds it; returns the release. */
export function lockScroll(): () => void {
  const html = document.documentElement;
  if (locks++ === 0) {
    previousOverflow = html.style.overflow;
    html.style.overflow = "hidden";
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--locks === 0) html.style.overflow = previousOverflow;
  };
}

/** The element `id` names in the root `from` lives in (document or shadow root). */
export const byId = (from: Node, id: string | null): HTMLElement | null =>
  id ? ((from.getRootNode() as Document | ShadowRoot).getElementById?.(id) ?? null) : null;

/** Whether the Popover API is available. */
export const hasPopover = () =>
  typeof HTMLElement !== "undefined" && Object.hasOwn(HTMLElement.prototype, "popover");
