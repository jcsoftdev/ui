"use client";

import { createContext, type ReactElement, type ReactNode, useContext } from "react";
import type { IntentBridge } from "./types.js";

export const noopIntentBridge: IntentBridge = {
  registerTarget: () => () => {},
};

const IntentBridgeContext = createContext<IntentBridge>(noopIntentBridge);

export function IntentBridgeProvider(props: {
  bridge: IntentBridge;
  children: ReactNode;
}): ReactElement {
  return (
    <IntentBridgeContext.Provider value={props.bridge}>
      {props.children}
    </IntentBridgeContext.Provider>
  );
}

export function useIntentBridge(): IntentBridge {
  return useContext(IntentBridgeContext);
}
