import { act, type ReactNode, StrictMode, useMemo, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { Slot } from "../utils/slot.js";
import { intentAttributes } from "./attributes.js";
import { IntentBridgeProvider } from "./bridge.js";
import type { IntentBridge, IntentSemanticExpectation, IntentTargetRef } from "./types.js";
import { useIntentTarget, useIntentTargets } from "./use-intent-target.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PassThrough = ({ children }: { children: ReactNode }) => children;

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
      return () => {
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

const mount = (node: ReactNode) => act(async () => root.render(node));

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

function HostWithOwnBridge(props: {
  ids: string[];
  setOn: "register" | "unregister";
  renders: { count: number };
  live: { count: number };
  strict: boolean;
}) {
  const Wrapper = props.strict ? StrictMode : PassThrough;
  return (
    <Wrapper>
      <InnerHost {...props} />
    </Wrapper>
  );
}

function InnerHost(props: {
  ids: string[];
  setOn: "register" | "unregister";
  renders: { count: number };
  live: { count: number };
  strict: boolean;
}) {
  const [, setTick] = useState(0);
  props.renders.count += 1;
  const bridge = useMemo<IntentBridge>(
    () => ({
      registerTarget() {
        props.live.count += 1;
        if (props.setOn === "register") setTick((tick) => tick + 1);
        return () => {
          props.live.count -= 1;
          if (props.setOn === "unregister") setTick((tick) => tick + 1);
        };
      },
    }),
    [props.setOn, props.live],
  );
  return (
    <IntentBridgeProvider bridge={bridge}>
      <Targets ids={props.ids} />
    </IntentBridgeProvider>
  );
}

function Targets(props: { ids: string[] }) {
  const single = useIntentTarget<HTMLButtonElement>({ intent: "single" });
  return (
    <>
      <button type="button" ref={single}>
        one
      </button>
      <List ids={props.ids} />
    </>
  );
}

describe("a bridge that updates React state", () => {
  const cases = [
    { setOn: "register", strict: false },
    { setOn: "unregister", strict: false },
    { setOn: "register", strict: true },
    { setOn: "unregister", strict: true },
  ] as const;
  for (const { setOn, strict } of cases) {
    test(`settles when ${setOn} sets state${strict ? " in strict mode" : ""}`, async () => {
      const renders = { count: 0 };
      const live = { count: 0 };
      await mount(
        <HostWithOwnBridge
          ids={["1", "2", "3"]}
          setOn={setOn}
          renders={renders}
          live={live}
          strict={strict}
        />,
      );
      const afterMount = renders.count;
      expect(afterMount).toBeLessThan(20);
      expect(live.count).toBe(4);
      await mount(
        <HostWithOwnBridge
          ids={["1", "2", "3"]}
          setOn={setOn}
          renders={renders}
          live={live}
          strict={strict}
        />,
      );
      expect(renders.count - afterMount).toBeLessThan(10);
      expect(live.count).toBe(4);
    });
  }
});

function SlotTarget(props: { intent: string; children: ReactNode }) {
  const ref = useIntentTarget<HTMLElement>({ intent: props.intent });
  return <Slot ref={ref}>{props.children}</Slot>;
}

function ButtonAsChildHost(props: {
  strict: boolean;
  renders: { count: number };
  live: { count: number };
}) {
  const [, setTick] = useState(0);
  props.renders.count += 1;
  const bridge = useMemo<IntentBridge>(
    () => ({
      registerTarget() {
        props.live.count += 1;
        setTick((tick) => tick + 1);
        return () => {
          props.live.count -= 1;
        };
      },
    }),
    [props.live],
  );
  const Wrapper = props.strict ? StrictMode : PassThrough;
  return (
    <Wrapper>
      <IntentBridgeProvider bridge={bridge}>
        <SlotTarget intent="go-link">
          <a href="/go">go</a>
        </SlotTarget>
      </IntentBridgeProvider>
    </Wrapper>
  );
}

describe("a Slot target under a bridge that updates React state", () => {
  for (const strict of [false, true]) {
    test(`settles with one live registration${strict ? " in strict mode" : ""}`, async () => {
      const renders = { count: 0 };
      const live = { count: 0 };
      await mount(<ButtonAsChildHost strict={strict} renders={renders} live={live} />);
      expect(renders.count).toBeLessThan(10);
      expect(live.count).toBe(1);
    });
  }
});

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
    expect(recorder.calls).toHaveLength(5);
  });

  test("the list binder does not churn registrations under strict mode", async () => {
    const recorder = recordingBridge();
    const render = (ids: string[]) => (
      <StrictMode>
        <IntentBridgeProvider bridge={recorder.bridge}>
          <List ids={ids} />
        </IntentBridgeProvider>
      </StrictMode>
    );
    await mount(render(["1", "2", "3"]));
    const afterMount = recorder.calls.length;
    await mount(render(["1", "2", "3"]));
    await mount(render(["1", "2", "3"]));
    expect(recorder.calls).toHaveLength(afterMount);
    expect(recorder.live()).toBe(3);
  });

  test("the default bridge is a no-op", async () => {
    await mount(<IntentButton intent="save" intentKey="9" />);
    const button = host.querySelector("button");
    expect(button?.getAttribute("data-intent")).toBe("save");
    expect(button?.getAttribute("data-intent-key")).toBe("9");
  });
});
