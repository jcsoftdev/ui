/// <reference types="@vitest/browser-playwright" />
// Its own file (its own page): nothing here imports the engine, so the resource list shows
// whether the watcher fetched it.
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import "../../test/glass-browser.css";
import { Card } from "../containers/card/card.js";
import { LiquidGlass } from "./liquid-glass.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const engineFetched = () =>
  performance
    .getEntriesByType("resource")
    .some((entry) => /\/glass\/refraction\.[jt]s/.test(entry.name));

test("without <LiquidGlass /> a liquid surface gets no lens and no engine chunk is fetched", async () => {
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  await act(async () =>
    root.render(<Card data-testid="liquid" material="liquid" className="h-24 w-40" />),
  );
  await new Promise((r) => setTimeout(r, 300));
  const card = host.querySelector("[data-testid=liquid]") as HTMLElement;
  expect(card.dataset.glassRefraction).toBeUndefined();
  expect(document.getElementById("ui-glass-refraction-defs")).toBeNull();
  expect(engineFetched()).toBe(false);

  await act(async () =>
    root.render(
      <>
        <LiquidGlass />
        <Card data-testid="liquid" material="liquid" className="h-24 w-40" />
      </>,
    ),
  );
  const lensed = () =>
    (host.querySelector("[data-testid=liquid]") as HTMLElement).dataset.glassRefraction;
  await vi.waitFor(() => expect(lensed()).toBe("on"));
  expect(engineFetched()).toBe(true);
  await act(async () => root.unmount());
  host.remove();
});
