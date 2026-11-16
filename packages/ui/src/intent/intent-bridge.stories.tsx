import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo, useState } from "react";
import { expect, within } from "storybook/test";
import { intentAttributes } from "./attributes.js";
import { IntentBridgeProvider } from "./bridge.js";
import type { IntentBridge } from "./types.js";
import { useIntentTarget } from "./use-intent-target.js";

function DemoButton() {
  const props = { intent: "demo-save" };
  const ref = useIntentTarget<HTMLButtonElement>(props);
  return (
    <button type="button" ref={ref} {...intentAttributes(props)}>
      Save
    </button>
  );
}

function BridgeDemo() {
  const [log, setLog] = useState("");
  const bridge = useMemo<IntentBridge>(
    () => ({
      registerTarget(ref, _element, expectation) {
        setLog(`${ref.intent} · ${expectation.role}`);
        return () => setLog("");
      },
    }),
    [],
  );
  return (
    <IntentBridgeProvider bridge={bridge}>
      <DemoButton />
      <output>{log}</output>
    </IntentBridgeProvider>
  );
}

const meta = {
  title: "Intent/Bridge",
  component: BridgeDemo,
  parameters: { layout: "centered" },
} satisfies Meta<typeof BridgeDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RegistersTarget: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole("button", { name: "Save" });
    await expect(button).toHaveAttribute("data-intent", "demo-save");
    await expect(canvasElement.querySelector("output")).toHaveTextContent("demo-save · button");
  },
};
