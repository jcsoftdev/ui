import { act, StrictMode, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { intentAttributes } from "./attributes.js";
import { IntentBridgeProvider } from "./bridge.js";
import type { IntentBridge, IntentSemanticExpectation, IntentTargetRef } from "./types.js";
import { useIntentTarget, useIntentTargets } from "./use-intent-target.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface Registration {
  ref: IntentTargetRef;
  element: Element;
  expectation: IntentSemanticExpectation;
}

function recordingBridge() {
  const calls: Registration[] = [];
  let live = 0;
  const bridge: IntentBridge = {
    registerTarget(ref, element, expectation) {
      calls.push({ ref, element, expectation });
      live += 1;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        live -= 1;
      };
    },
  };
  return { bridge, calls, live: () => live };
}

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

const mount = (node: React.ReactNode) => act(async () => root.render(node));

function IntentButton(props: { intent?: string; intentKey?: string }) {
  const ref = useIntentTarget<HTMLButtonElement>(props);
  return (
    <button type="button" ref={ref} {...intentAttributes(props)}>
      go
    </button>
  );
}

function Counter(props: { intent: string }) {
  const [count, setCount] = useState(0);
  return (
    <>
      <IntentButton intent={props.intent} intentKey="1" />
      <output>{count}</output>
      <button type="button" data-testid="bump" onClick={() => setCount(count + 1)}>
        bump
      </button>
    </>
  );
}

function List(props: { ids: string[] }) {
  const bind = useIntentTargets();
  return (
    <ul>
      {props.ids.map((id) => (
        <li key={id} ref={bind({ intent: "row", intentKey: id }, { role: "listitem" })}>
          {id}
        </li>
      ))}
    </ul>
  );
}

describe("intent bridge", () => {
  test("registers on mount and unregisters on unmount", async () => {
    const recorder = recordingBridge();
    await mount(
      <IntentBridgeProvider bridge={recorder.bridge}>
        <IntentButton intent="save" />
      </IntentBridgeProvider>,
    );
    expect(recorder.live()).toBe(1);
    expect(recorder.calls[0]?.expectation).toEqual({ role: "button", requireName: true });
    await act(async () => root.render(null));
    expect(recorder.live()).toBe(0);
  });

  test("does not register without an intent", async () => {
    const recorder = recordingBridge();
    await mount(
      <IntentBridgeProvider bridge={recorder.bridge}>
        <IntentButton intentKey="3" />
      </IntentBridgeProvider>,
    );
    expect(recorder.calls).toHaveLength(0);
    expect(host.querySelector("[data-intent]")).toBeNull();
  });

  test("an unrelated re-render does not re-register", async () => {
    const recorder = recordingBridge();
    await mount(
      <IntentBridgeProvider bridge={recorder.bridge}>
        <Counter intent="save" />
      </IntentBridgeProvider>,
    );
    await act(async () => host.querySelector<HTMLButtonElement>("[data-testid=bump]")?.click());
    expect(host.querySelector("output")?.textContent).toBe("1");
    expect(recorder.calls).toHaveLength(1);
  });

  test("a key change re-registers once", async () => {
    const recorder = recordingBridge();
    const render = (intentKey: string) => (
      <IntentBridgeProvider bridge={recorder.bridge}>
        <IntentButton intent="save" intentKey={intentKey} />
      </IntentBridgeProvider>
    );
    await mount(render("1"));
    await mount(render("2"));
    expect(recorder.calls).toHaveLength(2);
    expect(recorder.calls[1]?.ref).toEqual({ intent: "save", key: "2" });
    expect(recorder.live()).toBe(1);
  });

  test("strict mode leaves one live registration", async () => {
    const recorder = recordingBridge();
    await mount(
      <StrictMode>
        <IntentBridgeProvider bridge={recorder.bridge}>
          <IntentButton intent="save" />
        </IntentBridgeProvider>
      </StrictMode>,
    );
    expect(recorder.live()).toBe(1);
    await act(async () => root.render(null));
    expect(recorder.live()).toBe(0);
  });

  test("the list binder releases unmounted items", async () => {
    const recorder = recordingBridge();
    const render = (ids: string[]) => (
      <IntentBridgeProvider bridge={recorder.bridge}>
        <List ids={ids} />
      </IntentBridgeProvider>
    );
    await mount(render(["1", "2", "3", "4", "5"]));
    expect(recorder.live()).toBe(5);
    await mount(render(["1", "2"]));
    expect(recorder.live()).toBe(2);
  });

  test("the default bridge is a no-op", async () => {
    await mount(<IntentButton intent="save" intentKey="9" />);
    const button = host.querySelector("button");
    expect(button?.getAttribute("data-intent")).toBe("save");
    expect(button?.getAttribute("data-intent-key")).toBe("9");
  });
});
