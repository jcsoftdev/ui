// Server-side browser commands: the real Chromium accessibility tree (CDP), which is what assistive
// technology reads, including roles and states set through ElementInternals.
import type {} from "@vitest/browser-playwright";
import type { BrowserCommand } from "vitest/node";

export interface AxNode {
  role: string;
  name: string;
  /** The node's value: `aria-valuetext` of a range, the text of a field. */
  value?: unknown;
  properties: Record<string, unknown>;
}

interface RawAxNode {
  ignored?: boolean;
  role?: { value?: unknown };
  name?: { value?: unknown };
  value?: { value?: unknown };
  properties?: { name: string; value: { value?: unknown } }[];
}

export const axTree: BrowserCommand<[]> = async (context) => {
  if (context.provider.name !== "playwright")
    throw new Error("axTree needs the playwright provider");
  const page = context.page;
  const frame = await context.frame();
  const cdp = await page.context().newCDPSession(page);
  try {
    const { frameTree } = await cdp.send("Page.getFrameTree");
    const find = (tree: typeof frameTree): string | undefined =>
      tree.frame.url === frame.url() ? tree.frame.id : tree.childFrames?.map(find).find(Boolean);
    const frameId = find(frameTree);
    const { nodes } = (await cdp.send(
      "Accessibility.getFullAXTree",
      frameId ? { frameId } : {},
    )) as { nodes: RawAxNode[] };
    return nodes
      .filter((node) => !node.ignored)
      .map((node) => ({
        role: String(node.role?.value ?? ""),
        name: String(node.name?.value ?? ""),
        value: node.value?.value,
        properties: Object.fromEntries((node.properties ?? []).map((p) => [p.name, p.value.value])),
      }));
  } finally {
    await cdp.detach();
  }
};

/** Switches `prefers-reduced-motion` for the page (Playwright `emulateMedia`). */
export const reducedMotion: BrowserCommand<["reduce" | "no-preference"]> = async (
  context,
  value,
) => {
  await context.page.emulateMedia({ reducedMotion: value });
};
