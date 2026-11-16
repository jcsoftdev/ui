import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Button } from "../atoms/button/button.js";
import { Checkbox } from "../atoms/checkbox/checkbox.js";
import { Chip } from "../atoms/chip/chip.js";
import { IconButton } from "../atoms/icon-button/icon-button.js";
import { PressableFeedback } from "../atoms/pressable-feedback/pressable-feedback.js";
import { RadioGroup } from "../atoms/radio-group/radio-group.js";
import { Switch } from "../atoms/switch/switch.js";
import { IntentBridgeProvider } from "./bridge.js";
import type { IntentBridge } from "./types.js";

const registered = new Map<string, number>();

const recordingBridge: IntentBridge = {
  registerTarget(ref, _element, expectation) {
    const entry = `${ref.intent}:${ref.key ?? ""}:${expectation.role}`;
    registered.set(entry, (registered.get(entry) ?? 0) + 1);
    return () => registered.set(entry, (registered.get(entry) ?? 1) - 1);
  },
};

const isRegistered = (entry: string) => (registered.get(entry) ?? 0) > 0;

function AtomsDemo() {
  return (
    <IntentBridgeProvider bridge={recordingBridge}>
      <div className="flex flex-wrap items-center gap-3">
        <Button intent="save" intentKey="b1">
          Save
        </Button>
        <Button asChild intent="open" intentKey="l1">
          <a href="/orders">Orders</a>
        </Button>
        <IconButton label="Close" intent="close" intentKey="i1">
          <svg aria-hidden="true" viewBox="0 0 8 8" width="8" height="8" />
        </IconButton>
        <Checkbox aria-label="Agree" intent="agree" intentKey="c1" />
        <Switch aria-label="Notify" intent="notify" intentKey="s1" />
        <Chip onClick={() => undefined} role="button" intent="filter" intentKey="f1">
          Open
        </Chip>
        <PressableFeedback intent="press" intentKey="p1">
          <span>Press</span>
        </PressableFeedback>
        <RadioGroup
          aria-label="Size"
          options={[
            { value: "s", label: "Small", intent: "size" },
            { value: "m", label: "Medium", intent: "size", intentKey: "medium" },
          ]}
        />
      </div>
    </IntentBridgeProvider>
  );
}

const meta = {
  title: "Intent/Atoms",
  component: AtomsDemo,
  parameters: { layout: "centered" },
} satisfies Meta<typeof AtomsDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RegistersAtoms: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Save" })).toHaveAttribute(
      "data-intent",
      "save",
    );
    await expect(canvas.getByRole("link", { name: "Orders" })).toHaveAttribute(
      "data-intent-key",
      "l1",
    );
    await expect(canvas.getByRole("button", { name: "Close" })).toHaveAttribute(
      "data-intent",
      "close",
    );
    await expect(canvas.getByRole("checkbox", { name: "Agree" })).toHaveAttribute(
      "data-intent-key",
      "c1",
    );
    await expect(canvas.getByRole("switch", { name: "Notify" })).toHaveAttribute(
      "data-intent-key",
      "s1",
    );
    await expect(canvas.getByRole("button", { name: "Open" })).toHaveAttribute(
      "data-intent",
      "filter",
    );
    await expect(canvas.getByRole("radio", { name: "Medium" })).toHaveAttribute(
      "data-intent-key",
      "medium",
    );
    await expect(canvas.getByRole("radio", { name: "Small" })).toHaveAttribute(
      "data-intent-key",
      "s",
    );
    for (const entry of [
      "save:b1:button",
      "open:l1:link",
      "close:i1:button",
      "agree:c1:checkbox",
      "notify:s1:switch",
      "filter:f1:button",
      "press:p1:generic",
      "size:s:radio",
      "size:medium:radio",
    ]) {
      await expect(isRegistered(entry)).toBe(true);
    }
    await userEvent.click(canvas.getByRole("switch", { name: "Notify" }));
    await expect(canvas.getByRole("switch", { name: "Notify" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  },
};
