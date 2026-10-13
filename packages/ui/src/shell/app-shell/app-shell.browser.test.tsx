/// <reference types="@vitest/browser-playwright" />
import { act, Suspense, useContext } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { AppShell, AppShellContext, useAppShell } from "./app-shell.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;

interface Read {
  contextValue: unknown;
  compact: boolean;
}

const reads: Read[] = [];

function Reader() {
  const contextValue = useContext(AppShellContext);
  const shell = useAppShell();
  reads.push({ contextValue, compact: Boolean(shell?.compact) });
  return <span data-reader>{String(shell?.compact)}</span>;
}

const tree = (
  <AppShell style={{ width: 375 }}>
    <Reader />
    <Suspense fallback={null}>
      <p data-boundary>content</p>
    </Suspense>
  </AppShell>
);

const settle = (ms = 100) => new Promise((resolve) => setTimeout(resolve, ms));

describe("AppShell hydration", () => {
  test("the context value does not change between server render and hydration", async () => {
    reads.length = 0;
    const host = document.createElement("div");
    host.innerHTML = renderToString(tree);
    document.body.append(host);
    const serverBoundary = host.querySelector("[data-boundary]");
    const server = reads.splice(0);
    expect(server).toHaveLength(1);
    expect(server[0]?.compact).toBe(false);

    const recoverable: unknown[] = [];
    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(host, tree, { onRecoverableError: (error) => recoverable.push(error) });
    });
    await settle();

    const client = reads.splice(0);
    expect(client[0]?.compact).toBe(false);
    for (const read of client) expect(read.contextValue).toBe(client[0]?.contextValue);
    expect(client.at(-1)?.compact).toBe(true);
    expect(host.querySelector("[data-boundary]")).toBe(serverBoundary);
    expect(recoverable).toEqual([]);

    root?.unmount();
    host.remove();
  });
});
