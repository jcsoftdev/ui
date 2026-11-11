import type { IntentBridge, IntentSemanticExpectation, IntentTargetRef } from "./types.js";

const IDENTITY_SEPARATOR = "\u0000";

interface Registration {
  readonly identity: string;
  readonly element: Element;
  readonly expectation: IntentSemanticExpectation;
  readonly unregister: () => void;
  released: boolean;
}

export interface BridgeRegistrations {
  readonly byIdentity: Map<string, Registration[]>;
  readonly awaitingSweep: Set<Registration>;
}

const registrationsByBridge = new WeakMap<IntentBridge, BridgeRegistrations>();

export function registrationsOf(bridge: IntentBridge): BridgeRegistrations {
  const existing = registrationsByBridge.get(bridge);
  if (existing) return existing;
  const created: BridgeRegistrations = { byIdentity: new Map(), awaitingSweep: new Set() };
  registrationsByBridge.set(bridge, created);
  return created;
}

const identityOf = (ref: IntentTargetRef): string =>
  `${ref.intent}${IDENTITY_SEPARATOR}${ref.key ?? ""}`;

const sameExpectation = (a: IntentSemanticExpectation, b: IntentSemanticExpectation): boolean =>
  a.role === b.role && a.requireName === b.requireName;

function reportBridgeError(error: unknown): void {
  if (typeof globalThis.reportError === "function") globalThis.reportError(error);
  else console.error(error);
}

function drop(state: BridgeRegistrations, entry: Registration): void {
  state.awaitingSweep.delete(entry);
  const list = state.byIdentity.get(entry.identity);
  const index = list ? list.indexOf(entry) : -1;
  if (!list || index < 0) return;
  list.splice(index, 1);
  if (list.length === 0) state.byIdentity.delete(entry.identity);
  try {
    entry.unregister();
  } catch (error) {
    reportBridgeError(error);
  }
}

function sweepDisconnected(state: BridgeRegistrations): void {
  for (const entry of state.awaitingSweep) {
    if (!entry.element.isConnected) drop(state, entry);
  }
  state.awaitingSweep.clear();
}

function revive(state: BridgeRegistrations, entry: Registration): Registration {
  entry.released = false;
  state.awaitingSweep.delete(entry);
  return entry;
}

function releaseLater(state: BridgeRegistrations, entry: Registration): () => void {
  return () => {
    entry.released = true;
    state.awaitingSweep.add(entry);
    queueMicrotask(() => {
      if (entry.released) drop(state, entry);
    });
  };
}

export function attachTarget(
  bridge: IntentBridge,
  ref: IntentTargetRef,
  element: Element,
  expectation: IntentSemanticExpectation,
): () => void {
  const state = registrationsOf(bridge);
  const identity = identityOf(ref);
  const released = (state.byIdentity.get(identity) ?? []).filter((entry) => entry.released);
  const revivable = released.find(
    (entry) => entry.element === element && sameExpectation(entry.expectation, expectation),
  );
  for (const entry of released) if (entry !== revivable) drop(state, entry);
  if (element.isConnected) sweepDisconnected(state);
  if (revivable) return releaseLater(state, revive(state, revivable));
  const entry: Registration = {
    identity,
    element,
    expectation,
    unregister: bridge.registerTarget(ref, element, expectation),
    released: false,
  };
  const list = state.byIdentity.get(identity);
  if (list) list.push(entry);
  else state.byIdentity.set(identity, [entry]);
  return releaseLater(state, entry);
}
