import "@jcsoftdev/ui-tokens/styles/tokens.css";
import { commands } from "vitest/browser";
import type { AxNode } from "./commands.ts";

declare module "vitest/browser" {
  interface BrowserCommands {
    axTree: () => Promise<AxNode[]>;
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
