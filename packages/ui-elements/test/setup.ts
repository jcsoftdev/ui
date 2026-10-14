import "@jcsoftdev/ui-tokens/styles/tokens.css";
import { commands, userEvent } from "vitest/browser";
import type { AxNode, TouchStep } from "./commands.ts";

declare module "vitest/browser" {
  interface BrowserCommands {
    axTree: () => Promise<AxNode[]>;
    reducedMotion: (value: "reduce" | "no-preference") => Promise<void>;
    touch: (steps: TouchStep[]) => Promise<void>;
    timezone: (id: string | null) => Promise<void>;
  }
}

/** The accessibility node with `role` (and `name`, when given). */
export async function ax(role: string, name?: string): Promise<AxNode | undefined> {
  const nodes = await commands.axTree();
  return nodes.find((node) => node.role === role && (name === undefined || node.name === name));
}

export function mount(html: string): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.append(host);
  return host;
}

export const frame = () =>
  new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Rests the real mouse on a corner. It keeps the position the last test left it at, so an element
 * mounted under that spot is hovered before the test acts, and hover-driven state starts wrong.
 */
export async function parkPointer(): Promise<void> {
  const park = mount(
    '<i style="position:fixed;right:0;bottom:0;display:block;width:6px;height:6px"></i>',
  );
  await userEvent.hover(park.firstElementChild as Element);
  park.remove();
}
