"use client";

import { type RefCallback, useCallback, useMemo } from "react";
import { intentTargetRef, resolveExpectation } from "./attributes.js";
import { noopIntentBridge, useIntentBridge } from "./bridge.js";
import type {
  IntentBridge,
  IntentExpectationInput,
  IntentProps,
  IntentTargetBinder,
  IntentTargetRef,
} from "./types.js";

const CACHE_SEPARATOR = "\u0000";

const ignoreElement: RefCallback<Element> = () => undefined;

interface Registration {
  readonly element: Element;
  readonly role: string;
  readonly requireName: boolean;
  readonly unregister: () => void;
  released: boolean;
}

const registrations = new WeakMap<IntentBridge, Map<string, Registration[]>>();

function registrationsFor(bridge: IntentBridge, identity: string): Registration[] {
  const byIdentity = registrations.get(bridge) ?? new Map<string, Registration[]>();
  registrations.set(bridge, byIdentity);
  const list = byIdentity.get(identity) ?? [];
  byIdentity.set(identity, list);
  return list;
}

function drop(list: Registration[], entry: Registration): void {
  entry.unregister();
  list.splice(list.indexOf(entry), 1);
}

function attach(
  bridge: IntentBridge,
  ref: IntentTargetRef,
  element: Element,
  expectation: IntentExpectationInput | undefined,
): () => void {
  const resolved = resolveExpectation(expectation, element);
  const list = registrationsFor(bridge, `${ref.intent}${CACHE_SEPARATOR}${ref.key ?? ""}`);
  const revivable = list.find(
    (entry) =>
      entry.released &&
      entry.element === element &&
      entry.role === resolved.role &&
      entry.requireName === resolved.requireName,
  );
  if (revivable) revivable.released = false;
  for (const entry of [...list]) if (entry.released && entry !== revivable) drop(list, entry);
  const entry: Registration = revivable ?? {
    element,
    role: resolved.role,
    requireName: resolved.requireName,
    unregister: bridge.registerTarget(ref, element, resolved),
    released: false,
  };
  if (!revivable) list.push(entry);
  return () => {
    entry.released = true;
    queueMicrotask(() => {
      if (entry.released && list.includes(entry)) drop(list, entry);
    });
  };
}

function createTargetRef<E extends Element>(
  bridge: IntentBridge,
  props: IntentProps,
  expectation: IntentExpectationInput | undefined,
): RefCallback<E> | undefined {
  const ref = intentTargetRef(props);
  if (ref === undefined || bridge === noopIntentBridge) return undefined;
  return (element) => {
    if (element === null) return undefined;
    return attach(bridge, ref, element, expectation);
  };
}

export function useIntentTarget<E extends Element = Element>(
  props: IntentProps,
  expectation?: IntentExpectationInput,
): RefCallback<E> {
  const bridge = useIntentBridge();
  const { intent, intentKey } = props;
  const role = expectation?.role;
  const requireName = expectation?.requireName;
  return useMemo(
    () =>
      createTargetRef<E>(bridge, { intent, intentKey }, { role, requireName }) ??
      (ignoreElement as RefCallback<E>),
    [bridge, intent, intentKey, role, requireName],
  );
}

export function useIntentTargets(): IntentTargetBinder {
  const bridge = useIntentBridge();
  const bind = useCallback(
    (cache: Map<string, RefCallback<Element>>): IntentTargetBinder =>
      <E extends Element = Element>(
        props: IntentProps,
        expectation?: IntentExpectationInput,
      ): RefCallback<E> | undefined => {
        const ref = intentTargetRef(props);
        if (ref === undefined) return undefined;
        const cacheKey = [
          ref.intent,
          ref.key ?? "",
          expectation?.role ?? "",
          String(expectation?.requireName ?? true),
        ].join(CACHE_SEPARATOR);
        const cached = cache.get(cacheKey);
        if (cached !== undefined) return cached as RefCallback<E>;
        const inner = createTargetRef<Element>(bridge, props, expectation);
        if (inner === undefined) return undefined;
        const bound: RefCallback<Element> = (element) => {
          const unregister = inner(element);
          cache.set(cacheKey, bound);
          return () => {
            if (cache.get(cacheKey) === bound) cache.delete(cacheKey);
            if (typeof unregister === "function") unregister();
          };
        };
        cache.set(cacheKey, bound);
        return bound as RefCallback<E>;
      },
    [bridge],
  );
  return useMemo(() => bind(new Map()), [bind]);
}
