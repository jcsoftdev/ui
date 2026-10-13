import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { defineAppShell } from "../src/app-shell/app-shell.ts";
import { mount, wait } from "./setup.ts";

beforeAll(() => {
  defineAppShell();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("ui-app-shell", () => {
  it("is the `page` inline-size container that layouts query", () => {
    const host = mount(`<ui-app-shell style="width:1000px"></ui-app-shell>`);
    const style = getComputedStyle(host.querySelector("ui-app-shell")!);
    expect(style.containerName).toBe("page");
    expect(style.containerType).toBe("inline-size");
  });

  it("reports compact under 900 px and fires compact-change when it flips", async () => {
    const host = mount(`<ui-app-shell style="width:1000px"></ui-app-shell>`);
    const shell = host.querySelector<HTMLElement & { compact: boolean }>("ui-app-shell")!;
    const change = vi.fn();
    shell.addEventListener("compact-change", change);
    await wait(50);
    expect(shell.compact).toBe(false);
    expect(shell.hasAttribute("data-compact")).toBe(false);
    shell.style.width = "800px";
    await wait(100);
    expect(shell.compact).toBe(true);
    expect(shell.hasAttribute("data-compact")).toBe(true);
    expect(change).toHaveBeenCalledTimes(1);
    expect(change).toHaveBeenCalledWith(expect.objectContaining({ detail: { compact: true } }));
  });

  it("registers under a custom prefix", () => {
    expect(defineAppShell({ prefix: "acme" })).toBe("acme-app-shell");
  });
});
