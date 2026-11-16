import type { RefCallback } from "react";

export interface IntentTargetRef {
  readonly intent: string;
  readonly key?: string;
}

export interface IntentSemanticExpectation {
  readonly role: string;
  readonly requireName: boolean;
}

export interface IntentBridge {
  registerTarget(
    ref: IntentTargetRef,
    element: Element,
    expectation: IntentSemanticExpectation,
  ): () => void;
}

export interface IntentProps {
  intent?: string | undefined;
  intentKey?: string | undefined;
}

export interface IntentDataAttributes {
  "data-intent"?: string;
  "data-intent-key"?: string;
}

export interface IntentExpectationInput {
  role?: string | undefined;
  requireName?: boolean | undefined;
}

export interface RoleSource {
  readonly tagName: string;
  getAttribute(name: string): string | null;
}

export type IntentTargetBinder = <E extends Element = Element>(
  props: IntentProps,
  expectation?: IntentExpectationInput,
) => RefCallback<E> | undefined;
