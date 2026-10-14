// Server-side browser commands: the real Chromium accessibility tree (CDP), which is what assistive
// technology reads, including roles and states set through ElementInternals.
import type {} from "@vitest/browser-playwright";
import type { CDPSession } from "playwright";
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

export interface TouchStep {
  type: "touchStart" | "touchMove" | "touchEnd";
  /** Active touch points, in the test frame's viewport coordinates. */
  points: { x: number; y: number; id: number }[];
}

/**
 * Real touch input through CDP (`Input.dispatchTouchEvent`), so the browser applies `touch-action`
 * and produces genuine touch pointer events. Coordinates are relative to the test frame.
 */
export const touch: BrowserCommand<[TouchStep[]]> = async (context, steps) => {
  if (context.provider.name !== "playwright")
    throw new Error("touch needs the playwright provider");
  const page = context.page;
  const box = await context.iframe.owner().boundingBox();
  // The runner scales the test frame to fit its page: map frame pixels to page pixels.
  const inner = await (await context.frame()).evaluate(() => innerWidth);
  const scale = box && inner ? box.width / inner : 1;
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    for (const step of steps) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: step.type,
        touchPoints: step.points.map((p) => ({
          x: (box?.x ?? 0) + p.x * scale,
          y: (box?.y ?? 0) + p.y * scale,
          id: p.id,
        })),
      });
      await page.waitForTimeout(16);
    }
  } finally {
    await cdp.detach();
  }
};

let zone: CDPSession | undefined;

/**
 * Makes the page run in another time zone (`Emulation.setTimezoneOverride`); `null` restores it.
 * The override lives as long as the CDP session that set it.
 */
export const timezone: BrowserCommand<[string | null]> = async (context, id) => {
  if (context.provider.name !== "playwright")
    throw new Error("timezone needs the playwright provider");
  await zone?.detach().catch(() => undefined);
  zone = undefined;
  if (!id) return;
  zone = await context.page.context().newCDPSession(context.page);
  await zone.send("Emulation.setTimezoneOverride", { timezoneId: id });
};
