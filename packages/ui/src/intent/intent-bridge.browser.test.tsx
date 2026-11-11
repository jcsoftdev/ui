import {
  act,
  type ComponentProps,
  createRef,
  type ReactNode,
  StrictMode,
  useMemo,
  useState,
} from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { Slot } from "../utils/slot.js";
import { intentAttributes } from "./attributes.js";
import { IntentBridgeProvider } from "./bridge.js";
import { registrationsOf } from "./target-registrations.js";
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

function InlineRefHost(props: {
  strict: boolean;
  renders: { count: number };
  live: { count: number };
  seen: Array<Element | null>;
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
          <a href="/go" ref={(element) => void props.seen.push(element)}>
            go
          </a>
        </SlotTarget>
      </IntentBridgeProvider>
    </Wrapper>
  );
}

describe("a Slot target with an inline child ref under a bridge that updates React state", () => {
  for (const strict of [false, true]) {
    test(`settles and keeps feeding the consumer ref${strict ? " in strict mode" : ""}`, async () => {
      const renders = { count: 0 };
      const live = { count: 0 };
      const seen: Array<Element | null> = [];
      await mount(<InlineRefHost strict={strict} renders={renders} live={live} seen={seen} />);
      expect(renders.count).toBeLessThan(10);
      expect(live.count).toBe(1);
      expect(seen.some((element) => element instanceof HTMLAnchorElement)).toBe(true);
      const anchor = host.querySelector("a");
      const last = seen.filter((element) => element !== null).at(-1);
      expect(last).toBe(anchor);
    });
  }
});

function uniqueBridge() {
  const live = new Map<string, Element>();
  const duplicates: string[] = [];
  const events: string[] = [];
  const unregisterCalls: number[] = [];
  const peak = { live: 0 };
  const bridge: IntentBridge = {
    registerTarget(ref, element, expectation) {
      const identity = `${ref.intent}|${ref.key ?? ""}`;
      if (live.has(identity)) duplicates.push(identity);
      live.set(identity, element);
      peak.live = Math.max(peak.live, live.size);
      events.push(`register ${identity} ${expectation.role}`);
      const index = unregisterCalls.push(0) - 1;
      return () => {
        unregisterCalls[index] = (unregisterCalls[index] ?? 0) + 1;
        if (live.get(identity) === element) live.delete(identity);
        events.push(`unregister ${identity}`);
      };
    },
  };
  const count = (kind: "register" | "unregister") =>
    events.filter((event) => event.startsWith(`${kind} `)).length;
  return { bridge, live, duplicates, events, unregisterCalls, count, peak };
}

function SaveButton(props: { label: string; intent: string | undefined; inline: boolean }) {
  const ref = useIntentTarget<HTMLElement>({ intent: props.intent });
  if (!props.inline) {
    return (
      <button type="button" ref={ref}>
        {props.label}
      </button>
    );
  }
  return (
    <Slot ref={ref}>
      <button type="button" ref={(element) => void element}>
        {props.label}
      </button>
    </Slot>
  );
}

function MovingSave(props: { owner: number; inline: boolean }) {
  return (
    <>
      <SaveButton
        label="first"
        intent={props.owner === 0 ? "save" : undefined}
        inline={props.inline}
      />
      <SaveButton
        label="second"
        intent={props.owner === 1 ? "save" : undefined}
        inline={props.inline}
      />
    </>
  );
}

const buttonLabelled = (label: string) =>
  [...host.querySelectorAll("button")].find((button) => button.textContent === label);

describe("an identity that moves between elements that stay mounted", () => {
  const cases = [
    { strict: false, inline: false },
    { strict: true, inline: false },
    { strict: false, inline: true },
    { strict: true, inline: true },
  ];
  for (const { strict, inline } of cases) {
    const name = `${strict ? "in strict mode" : "plainly"}${inline ? " with inline child refs" : ""}`;
    test(`never has two live registrations, ${name}`, async () => {
      const recorder = uniqueBridge();
      const Wrapper = strict ? StrictMode : PassThrough;
      const render = (owner: number) => (
        <Wrapper>
          <IntentBridgeProvider bridge={recorder.bridge}>
            <MovingSave owner={owner} inline={inline} />
          </IntentBridgeProvider>
        </Wrapper>
      );
      for (const owner of [0, 1, 0, 1]) {
        await mount(render(owner));
        expect(recorder.duplicates).toEqual([]);
        expect(recorder.live.size).toBe(1);
        expect(recorder.live.get("save|")).toBe(buttonLabelled(owner === 0 ? "first" : "second"));
      }
    });
  }
});

const windowSlots = (size: number) =>
  Array.from({ length: size }, (_, position) => `slot-${position}`);

function IndexKeyedWindow(props: { start: number; slots: readonly string[] }) {
  const bind = useIntentTargets();
  return (
    <ul>
      {props.slots.map((slot, position) => {
        const id = String(props.start + position);
        return (
          <li key={slot} ref={bind({ intent: "row", intentKey: id })}>
            {id}
          </li>
        );
      })}
    </ul>
  );
}

const rowIdentities = (start: number, size: number) =>
  Array.from({ length: size }, (_, position) => `row|${start + position}`).sort();

describe("a list keyed by index whose window shifts", () => {
  for (const strict of [false, true]) {
    test(`never has two live registrations${strict ? " in strict mode" : ""}`, async () => {
      const recorder = uniqueBridge();
      const slots = windowSlots(5);
      const Wrapper = strict ? StrictMode : PassThrough;
      for (const start of [0, 1, 2, 1]) {
        await mount(
          <Wrapper>
            <IntentBridgeProvider bridge={recorder.bridge}>
              <IndexKeyedWindow start={start} slots={slots} />
            </IntentBridgeProvider>
          </Wrapper>,
        );
        expect(recorder.duplicates).toEqual([]);
        expect([...recorder.live.keys()].sort()).toEqual(rowIdentities(start, 5));
      }
    });
  }
});

function IdKeyedWindow(props: { start: number; size: number }) {
  const bind = useIntentTargets();
  const ids = Array.from({ length: props.size }, (_, position) => String(props.start + position));
  return (
    <ul>
      {ids.map((id) => (
        <li key={id} ref={bind({ intent: "row", intentKey: id })}>
          {id}
        </li>
      ))}
    </ul>
  );
}

test("a scrolling window releases the rows that leave before the rows that enter register", async () => {
  const recorder = uniqueBridge();
  const size = 15;
  for (const start of [0, 5, 10, 3]) {
    await mount(
      <IntentBridgeProvider bridge={recorder.bridge}>
        <IdKeyedWindow start={start} size={size} />
      </IntentBridgeProvider>,
    );
    expect([...recorder.live.keys()].sort()).toEqual(rowIdentities(start, size));
  }
  expect(recorder.peak.live).toBe(size);
  expect(recorder.duplicates).toEqual([]);
});

function RoleTarget(props: { role: string }) {
  const ref = useIntentTarget<HTMLButtonElement>({ intent: "toggle" }, { role: props.role });
  return (
    <button type="button" ref={ref}>
      toggle
    </button>
  );
}

test("a role change on the same element unregisters before it registers again", async () => {
  const recorder = uniqueBridge();
  const render = (role: string) => (
    <IntentBridgeProvider bridge={recorder.bridge}>
      <RoleTarget role={role} />
    </IntentBridgeProvider>
  );
  await mount(render("button"));
  await mount(render("switch"));
  expect(recorder.events).toEqual([
    "register toggle| button",
    "unregister toggle|",
    "register toggle| switch",
  ]);
});

function InlineRefList(props: { ids: readonly string[] }) {
  const bind = useIntentTargets();
  return (
    <ul>
      {props.ids.map((id) => (
        <Slot
          key={id}
          ref={bind<HTMLElement>({ intent: "row", intentKey: id }, { role: "listitem" })}
        >
          <li ref={(element) => void element}>{id}</li>
        </Slot>
      ))}
    </ul>
  );
}

test("the list binder with inline child refs in strict mode keeps its registrations across re-renders, shrink and regrow", async () => {
  const recorder = uniqueBridge();
  const render = (ids: readonly string[]) => (
    <StrictMode>
      <IntentBridgeProvider bridge={recorder.bridge}>
        <InlineRefList ids={ids} />
      </IntentBridgeProvider>
    </StrictMode>
  );
  await mount(render(["1", "2", "3", "4", "5"]));
  expect(recorder.count("register")).toBe(5);
  await mount(render(["1", "2", "3", "4", "5"]));
  await mount(render(["1", "2", "3", "4", "5"]));
  expect(recorder.count("register")).toBe(5);
  await mount(render(["1", "2"]));
  await mount(render(["2", "1", "6"]));
  expect([...recorder.live.keys()].sort()).toEqual(["row|1", "row|2", "row|6"]);
  expect(recorder.count("unregister")).toBe(3);
  expect(recorder.duplicates).toEqual([]);
});

function SettlingHost(props: { renders: { count: number }; live: { count: number } }) {
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
  return (
    <IntentBridgeProvider bridge={bridge}>
      <SlotTarget intent="save">
        <button type="button" ref={(element) => void element}>
          save
        </button>
      </SlotTarget>
      <SlotTarget intent="cancel">
        <button type="button" ref={(element) => void element}>
          cancel
        </button>
      </SlotTarget>
    </IntentBridgeProvider>
  );
}

test("distinct targets with inline child refs settle in a container outside the document", async () => {
  const detached = createRoot(document.createElement("div"));
  const renders = { count: 0 };
  const live = { count: 0 };
  try {
    await act(async () => detached.render(<SettlingHost renders={renders} live={live} />));
    expect(renders.count).toBeLessThan(10);
    expect(live.count).toBe(2);
  } finally {
    await act(async () => detached.unmount());
  }
  expect(live.count).toBe(0);
});

describe("unmounting for good", () => {
  for (const strict of [false, true]) {
    test(`unregisters each registration exactly once over 200 cycles and keeps nothing${strict ? " in strict mode" : ""}`, async () => {
      const recorder = uniqueBridge();
      const Wrapper = strict ? StrictMode : PassThrough;
      for (let cycle = 0; cycle < 200; cycle += 1) {
        await mount(
          <Wrapper>
            <IntentBridgeProvider bridge={recorder.bridge}>
              <IntentButton intent="save" intentKey={String(cycle)} />
            </IntentBridgeProvider>
          </Wrapper>,
        );
        await mount(null);
      }
      expect(recorder.unregisterCalls).toHaveLength(200);
      expect(recorder.unregisterCalls.every((calls) => calls === 1)).toBe(true);
      expect(recorder.live.size).toBe(0);
      const state = registrationsOf(recorder.bridge);
      expect(state.byIdentity.size).toBe(0);
      expect(state.awaitingSweep.size).toBe(0);
    });
  }

  test("a throwing unregister is reported and does not block later registrations", async () => {
    const reported: unknown[] = [];
    const original = globalThis.reportError;
    globalThis.reportError = (error: unknown) => void reported.push(error);
    let registered = 0;
    const bridge: IntentBridge = {
      registerTarget() {
        registered += 1;
        return () => {
          throw new Error("unregister failed");
        };
      },
    };
    const render = (shown: boolean) => (
      <IntentBridgeProvider bridge={bridge}>
        {shown ? <IntentButton intent="save" /> : null}
      </IntentBridgeProvider>
    );
    try {
      await mount(render(true));
      await mount(render(false));
      expect(reported).toHaveLength(1);
      await mount(render(true));
      expect(registered).toBe(2);
      expect(reported).toHaveLength(1);
      await mount(render(false));
      expect(reported).toHaveLength(2);
      expect(registrationsOf(bridge).byIdentity.size).toBe(0);
    } finally {
      globalThis.reportError = original;
    }
  });
});

async function countIsConnectedReads(run: () => Promise<void>): Promise<number> {
  const descriptor = Object.getOwnPropertyDescriptor(Node.prototype, "isConnected");
  const read = descriptor?.get;
  if (!descriptor || !read) throw new Error("Node.prototype.isConnected has no getter");
  let reads = 0;
  Object.defineProperty(Node.prototype, "isConnected", {
    ...descriptor,
    get(this: Node) {
      reads += 1;
      return read.call(this);
    },
  });
  try {
    await run();
  } finally {
    Object.defineProperty(Node.prototype, "isConnected", descriptor);
  }
  return reads;
}

test("shifting 3,000 index-keyed targets in one commit sweeps each released entry once", async () => {
  const size = 3000;
  const recorder = uniqueBridge();
  const slots = windowSlots(size);
  const render = (start: number) => (
    <IntentBridgeProvider bridge={recorder.bridge}>
      <IndexKeyedWindow start={start} slots={slots} />
    </IntentBridgeProvider>
  );
  await mount(render(0));
  const reads = await countIsConnectedReads(() => mount(render(1)));
  expect(reads).toBeLessThan(size * 3);
  expect(recorder.duplicates).toEqual([]);
  expect(recorder.live.size).toBe(size);
});

function HandForwardingButton({ ref, ...props }: ComponentProps<"button">) {
  return (
    <button
      type="button"
      {...props}
      ref={(node) => {
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
    />
  );
}

function HandForwardedTarget(props: { asChild: boolean; label: string }) {
  const ref = useIntentTarget<HTMLButtonElement>({ intent: "save" });
  if (props.asChild) {
    return (
      <Slot ref={ref}>
        <HandForwardingButton>{props.label}</HandForwardingButton>
      </Slot>
    );
  }
  return <HandForwardingButton ref={ref}>{props.label}</HandForwardingButton>;
}

function HandForwardedList(props: { ids: readonly string[]; label: string }) {
  const bind = useIntentTargets();
  return (
    <>
      {props.ids.map((id) => (
        <HandForwardingButton key={id} ref={bind({ intent: "row", intentKey: id })}>
          {`${props.label} ${id}`}
        </HandForwardingButton>
      ))}
    </>
  );
}

describe("a target whose ref is forwarded by hand and called with null", () => {
  const cases = [
    { asChild: false, strict: false },
    { asChild: false, strict: true },
    { asChild: true, strict: false },
    { asChild: true, strict: true },
  ];
  for (const { asChild, strict } of cases) {
    const name = `${asChild ? "through Slot" : "directly"}${strict ? " in strict mode" : ""}`;
    test(`keeps one registration across re-renders and releases it on unmount, ${name}`, async () => {
      const recorder = uniqueBridge();
      const Wrapper = strict ? StrictMode : PassThrough;
      for (const label of ["a", "b", "c"]) {
        await mount(
          <Wrapper>
            <IntentBridgeProvider bridge={recorder.bridge}>
              <HandForwardedTarget asChild={asChild} label={label} />
            </IntentBridgeProvider>
          </Wrapper>,
        );
        expect(recorder.live.get("save|")).toBe(host.querySelector("button"));
      }
      expect(recorder.count("register")).toBe(1);
      expect(recorder.duplicates).toEqual([]);
      await mount(null);
      expect(recorder.unregisterCalls).toEqual([1]);
      expect(recorder.live.size).toBe(0);
      expect(registrationsOf(recorder.bridge).byIdentity.size).toBe(0);
    });
  }

  test("keeps one registration per row through the list binder and releases each on unmount", async () => {
    const recorder = uniqueBridge();
    const render = (label: string) => (
      <IntentBridgeProvider bridge={recorder.bridge}>
        <HandForwardedList ids={["1", "2", "3"]} label={label} />
      </IntentBridgeProvider>
    );
    await mount(render("a"));
    await mount(render("b"));
    await mount(render("c"));
    expect(recorder.count("register")).toBe(3);
    expect(recorder.duplicates).toEqual([]);
    await mount(null);
    expect(recorder.unregisterCalls).toEqual([1, 1, 1]);
    expect(recorder.live.size).toBe(0);
  });
});

test("warns once in development when an intent and key are already live on another element", async () => {
  const warnings: unknown[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => void warnings.push(args[0]);
  const recorder = uniqueBridge();
  const render = (label: string) => (
    <IntentBridgeProvider bridge={recorder.bridge}>
      <IntentButton intent="save" intentKey={label} />
      <IntentButton intent="save" intentKey="twin" />
      <IntentButton intent="save" intentKey="twin" />
    </IntentBridgeProvider>
  );
  try {
    await mount(render("one"));
    await mount(render("two"));
  } finally {
    console.warn = original;
  }
  expect(warnings).toEqual([
    'Intent target "save" with key "twin" is already registered on another element. An intent and key must name one element at a time.',
  ]);
});

describe("Slot object refs", () => {
  test("are cleared on unmount and when the child is swapped", async () => {
    const slotRef = createRef<HTMLElement>();
    const childRef = createRef<HTMLElement>();
    const render = (tag: "section" | "aside") => (
      <Slot ref={slotRef}>
        {tag === "section" ? <section ref={childRef} /> : <aside ref={childRef} />}
      </Slot>
    );
    await mount(render("section"));
    expect(slotRef.current).toBe(host.querySelector("section"));
    expect(childRef.current).toBe(host.querySelector("section"));
    await mount(render("aside"));
    expect(slotRef.current).toBe(host.querySelector("aside"));
    expect(childRef.current).toBe(host.querySelector("aside"));
    await act(async () => root.render(null));
    expect(slotRef.current).toBeNull();
    expect(childRef.current).toBeNull();
  });
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
