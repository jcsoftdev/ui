"use client";

import { type RefCallback, useCallback, useMemo } from "react";
import { intentTargetRef, resolveExpectation } from "./attributes.js";
import { noopIntentBridge, useIntentBridge } from "./bridge.js";
import type {
  IntentBridge,
  IntentExpectationInput,
  IntentProps,
  IntentTargetBinder,
} from "./types.js";

const CACHE_SEPARATOR = "\u0000";

const ignoreElement: RefCallback<Element> = () => undefined;

function createTargetRef<E extends Element>(
  bridge: IntentBridge,
  props: IntentProps,
  expectation: IntentExpectationInput | undefined,
): RefCallback<E> | undefined {
  const ref = intentTargetRef(props);
  if (ref === undefined || bridge === noopIntentBridge) return undefined;
  return (element) => {
    if (element === null) return undefined;
    return bridge.registerTarget(ref, element, resolveExpectation(expectation, element));
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
          return () => {
            cache.delete(cacheKey);
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
