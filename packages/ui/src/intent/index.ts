export {
  COLUMN_ID_ATTRIBUTE,
  INTENT_ATTRIBUTE,
  INTENT_CHANGED_ATTRIBUTE,
  INTENT_HIGHLIGHT_ATTRIBUTE,
  INTENT_KEY_ATTRIBUTE,
  implicitRoleOf,
  intentAttributes,
  intentTargetRef,
  ROW_ID_ATTRIBUTE,
  resolveExpectation,
} from "./attributes.js";
export { IntentBridgeProvider, noopIntentBridge, useIntentBridge } from "./bridge.js";
export type {
  IntentBridge,
  IntentDataAttributes,
  IntentExpectationInput,
  IntentProps,
  IntentSemanticExpectation,
  IntentTargetBinder,
  IntentTargetRef,
  RoleSource,
} from "./types.js";
export { useIntentTarget, useIntentTargets } from "./use-intent-target.js";
