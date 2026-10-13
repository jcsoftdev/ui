import { createDisclosure, type Disclosure } from "@jcsoftdev/ui-core/disclosure";
import { emit, ensureId, toggleAttr } from "./base.js";

const SVG = "http://www.w3.org/2000/svg";

export interface DisclosureShell {
  /** The header button: `aria-expanded`, `aria-controls`. */
  trigger: HTMLButtonElement;
  /** The always-visible header content. */
  header: HTMLElement;
  /** The collapsible panel: `role="region"`, labelled by the trigger, `inert` while closed. */
  panel: HTMLElement;
  /** The panel's content slot. */
  body: HTMLElement;
  disclosure: Disclosure;
  /** Call from `attributeChangedCallback("open")`: applies the attribute and announces the change. */
  sync(): void;
}

function chevron(): SVGElement {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.dataset.uiPart = "chevron";
  const path = document.createElementNS(SVG, "path");
  path.setAttribute("d", "m6 9 6 6 6-6");
  svg.append(path);
  return svg;
}

/**
 * Builds the header-button + collapsible-panel structure shared by `<ui-chain-of-thought>` and
 * `<ui-tool-call>` inside `host`, on top of ui-core's `createDisclosure`. The host's `open`
 * attribute is the single source of truth: a click flips it, and the attribute drives the
 * disclosure (`control`), so authors can also set it from outside.
 */
export function buildDisclosureShell(host: HTMLElement, id: string): DisclosureShell {
  const trigger = document.createElement("button");
  trigger.dataset.uiPart = "trigger";
  ensureId(trigger, `${id}-trigger`);
  const header = document.createElement("span");
  header.dataset.uiPart = "header";
  trigger.append(header, chevron());

  const panel = document.createElement("div");
  panel.dataset.uiPart = "panel";
  panel.setAttribute("role", "region");
  panel.setAttribute("aria-labelledby", trigger.id);
  const inner = document.createElement("div");
  inner.dataset.uiPart = "inner";
  const body = document.createElement("div");
  body.dataset.uiPart = "body";
  inner.append(body);
  panel.append(inner);

  const disclosure = createDisclosure({
    trigger,
    panel,
    open: host.hasAttribute("open"),
    onOpenChange: (next) => toggleAttr(host, "open", next),
  });
  host.replaceChildren(trigger, panel);

  let announced = host.hasAttribute("open");
  return {
    trigger,
    header,
    panel,
    body,
    disclosure,
    sync() {
      const open = host.hasAttribute("open");
      disclosure.control(open);
      if (open === announced) return;
      announced = open;
      emit(host, open ? "open" : "close");
    },
  };
}
