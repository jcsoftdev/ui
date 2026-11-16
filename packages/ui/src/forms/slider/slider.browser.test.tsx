import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { IntentBridgeProvider } from "../../intent/bridge.js";
import type { IntentBridge, IntentTargetRef } from "../../intent/types.js";
import { Slider } from "./slider.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

function renderRange(intentKey: string | undefined) {
  const live: IntentTargetRef[] = [];
  const bridge: IntentBridge = {
    registerTarget(ref) {
      live.push(ref);
      return () => {
        live.splice(live.indexOf(ref), 1);
      };
    },
  };
  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  const mounted = act(async () =>
    root.render(
      <StrictMode>
        <IntentBridgeProvider bridge={bridge}>
          <Slider aria-label="Price" defaultValue={[10, 50]} intent="price" intentKey={intentKey} />
        </IntentBridgeProvider>
      </StrictMode>,
    ),
  );
  return { live, warn, mounted };
}

test("a range slider without intentKey registers both thumbs with distinct keys", async () => {
  const { live, warn, mounted } = renderRange(undefined);
  await mounted;
  expect(live.map((ref) => ref.key).sort()).toEqual(["end", "start"]);
  expect(warn).not.toHaveBeenCalled();
  expect(
    [...host.querySelectorAll("[role=slider]")].map((el) => el.getAttribute("data-intent-key")),
  ).toEqual(["start", "end"]);
  warn.mockRestore();
});

test("a range slider with an intentKey prefixes each thumb key", async () => {
  const { live, warn, mounted } = renderRange("p");
  await mounted;
  expect(live.map((ref) => ref.key).sort()).toEqual(["p:end", "p:start"]);
  expect(warn).not.toHaveBeenCalled();
  warn.mockRestore();
});
