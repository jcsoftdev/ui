import type { Meta, StoryObj } from "@storybook/react-vite";
import { createRef, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { expect, within } from "storybook/test";
import { AccentPicker } from "../forms/accent-picker/index.js";
import { CheckboxButtonGroup } from "../forms/checkbox-button-group/index.js";
import { ChipGroup } from "../forms/chip-group/index.js";
import { Combobox } from "../forms/combobox/index.js";
import { CopyField } from "../forms/copy-field/index.js";
import { DatePicker, DateTimePicker } from "../forms/date-picker/index.js";
import { Dropzone } from "../forms/dropzone/index.js";
import { EmojiPicker } from "../forms/emoji-picker/index.js";
import { EmojiReactionButton } from "../forms/emoji-reaction-button/index.js";
import { Field } from "../forms/field/index.js";
import { Form } from "../forms/form/index.js";
import { InlineSelect } from "../forms/inline-select/index.js";
import { Input } from "../forms/input/index.js";
import { InputIcon } from "../forms/input-icon/index.js";
import { NativeSelect } from "../forms/native-select/index.js";
import { NumberStepper } from "../forms/number-stepper/index.js";
import { PasswordInput } from "../forms/password-input/index.js";
import { PinInput } from "../forms/pin-input/index.js";
import { RadioButtonGroup } from "../forms/radio-button-group/index.js";
import { Rating } from "../forms/rating/index.js";
import { Select } from "../forms/select/index.js";
import { SelectMenu } from "../forms/select-menu/index.js";
import { Slider } from "../forms/slider/index.js";
import { Textarea } from "../forms/textarea/index.js";
import { TimeInput } from "../forms/time-input/index.js";
import { IntentBridgeProvider } from "./bridge.js";
import type { IntentBridge } from "./types.js";

interface Registration {
  intent: string;
  key: string | undefined;
  role: string;
}

const options = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta" },
];
const itemsFor = (intent: string, prefix: string) =>
  options.map((option) => ({ value: option.value, label: `${prefix} ${option.label}`, intent }));
const swatches = itemsFor("forms-accent-item", "Accent").map((option) => ({
  ...option,
  swatch: "red",
}));

function FormsIntentRows() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const bridge = useMemo<IntentBridge>(
    () => ({
      registerTarget(ref, _element, expectation) {
        const entry = { intent: ref.intent, key: ref.key, role: expectation.role };
        setRegistrations((current) => [...current, entry]);
        return () =>
          setRegistrations((current) => current.filter((candidate) => candidate !== entry));
      },
    }),
    [],
  );
  return (
    <IntentBridgeProvider bridge={bridge}>
      <div className="flex max-w-md flex-col gap-3">
        <Input aria-label="Input" intent="forms-input" />
        <InputIcon aria-label="Input icon" icon="@" intent="forms-input-icon" />
        <PasswordInput aria-label="Password" intent="forms-password" />
        <Textarea aria-label="Textarea" intent="forms-textarea" />
        <Select aria-label="Select" intent="forms-select" />
        <NativeSelect aria-label="Native select" options={options} intent="forms-native-select" />
        <InlineSelect aria-label="Inline select" options={options} intent="forms-inline-select" />
        <Combobox aria-label="Combobox" options={options} intent="forms-combobox" />
        <SelectMenu aria-label="Select menu" options={options} intent="forms-select-menu" />
        <DatePicker aria-label="Date" intent="forms-date" />
        <DateTimePicker aria-label="Date time" intent="forms-date-time" />
        <TimeInput aria-label="Time" intent="forms-time" />
        <NumberStepper aria-label="Quantity" intent="forms-number" />
        <Slider aria-label="Volume" intent="forms-slider" />
        <Slider aria-label="Budget" defaultValue={[10, 20]} intent="forms-range" intentKey="r" />
        <Rating aria-label="Score" intent="forms-rating" />
        <PinInput label="Pin" intent="forms-pin" />
        <ChipGroup
          aria-label="Chips"
          options={itemsFor("forms-chips-item", "Chip")}
          intent="forms-chips"
        />
        <CheckboxButtonGroup
          aria-label="Checks"
          options={itemsFor("forms-checks-item", "Check")}
          intent="forms-checks"
          name="checks"
        />
        <RadioButtonGroup
          aria-label="Radios"
          options={itemsFor("forms-radios-item", "Radio")}
          intent="forms-radios"
        />
        <AccentPicker aria-label="Accent" options={swatches} intent="forms-accent" />
        <Dropzone
          onFiles={() => undefined}
          title="Drop files"
          browseLabel="Browse files"
          intent="forms-dropzone"
        />
        <CopyField label="Link" value="https://example.test" intent="forms-copy" />
        <EmojiPicker intent="forms-emoji-picker" />
        <EmojiReactionButton emoji="👍" count={1} intent="forms-reaction" />
        <Form aria-label="Form" intent="forms-form" />
      </div>
      <output data-testid="registrations">{JSON.stringify(registrations)}</output>
    </IntentBridgeProvider>
  );
}

const meta = {
  title: "Intent/Forms",
  component: FormsIntentRows,
  parameters: { layout: "padded" },
} satisfies Meta<typeof FormsIntentRows>;

export default meta;
type Story = StoryObj<typeof meta>;

const registrationsOf = (canvasElement: HTMLElement): Registration[] =>
  JSON.parse(
    canvasElement.querySelector("[data-testid=registrations]")?.textContent ?? "[]",
  ) as Registration[];

const expectedRegistrations: Registration[] = [
  { intent: "forms-password", key: undefined, role: "textbox" },
  { intent: "forms-combobox", key: undefined, role: "combobox" },
  { intent: "forms-select-menu", key: undefined, role: "combobox" },
  { intent: "forms-date", key: undefined, role: "textbox" },
  { intent: "forms-date-time", key: undefined, role: "textbox" },
  { intent: "forms-time", key: undefined, role: "textbox" },
  { intent: "forms-number", key: undefined, role: "spinbutton" },
  { intent: "forms-slider", key: undefined, role: "slider" },
  { intent: "forms-range", key: "r:start", role: "slider" },
  { intent: "forms-range", key: "r:end", role: "slider" },
  { intent: "forms-rating", key: undefined, role: "slider" },
  { intent: "forms-pin", key: undefined, role: "textbox" },
  { intent: "forms-chips", key: undefined, role: "group" },
  { intent: "forms-chips-item", key: "a", role: "button" },
  { intent: "forms-checks", key: undefined, role: "group" },
  { intent: "forms-checks-item", key: "b", role: "checkbox" },
  { intent: "forms-radios", key: undefined, role: "radiogroup" },
  { intent: "forms-radios-item", key: "b", role: "radio" },
  { intent: "forms-accent", key: undefined, role: "radiogroup" },
  { intent: "forms-accent-item", key: "b", role: "radio" },
  { intent: "forms-dropzone", key: undefined, role: "button" },
  { intent: "forms-copy", key: undefined, role: "textbox" },
  { intent: "forms-emoji-picker", key: undefined, role: "group" },
  { intent: "forms-reaction", key: undefined, role: "button" },
];

export const RegistersClientTargets: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("combobox", { name: "Combobox" });
    const registrations = registrationsOf(canvasElement);
    const countOf = (intent: string, key?: string) =>
      registrations.filter((entry) => entry.intent === intent && (!key || entry.key === key))
        .length;
    for (const intent of [
      "forms-password",
      "forms-combobox",
      "forms-select-menu",
      "forms-date",
      "forms-date-time",
      "forms-time",
      "forms-number",
      "forms-slider",
      "forms-rating",
      "forms-pin",
      "forms-radios",
      "forms-accent",
      "forms-dropzone",
      "forms-copy",
      "forms-emoji-picker",
      "forms-reaction",
    ]) {
      await expect(countOf(intent)).toBe(1);
    }
    await expect(countOf("forms-range")).toBe(2);
    for (const intent of ["forms-chips", "forms-checks", "forms-radios", "forms-accent"]) {
      await expect(countOf(intent)).toBe(1);
      await expect(countOf(`${intent}-item`)).toBe(2);
      await expect(countOf(`${intent}-item`, "a")).toBe(1);
    }
    for (const entry of expectedRegistrations) {
      const found = registrations.some(
        (candidate) =>
          candidate.intent === entry.intent &&
          candidate.role === entry.role &&
          (entry.key === undefined || candidate.key === entry.key),
      );
      await expect({ entry, found }).toEqual({ entry, found: true });
    }
    await expect(registrations.some((entry) => entry.intent === "forms-input")).toBe(false);
  },
};

export const FindsTargetsByRoleAndName: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const targets: [string, string, string][] = [
      ["combobox", "Combobox", "forms-combobox"],
      ["combobox", "Select menu", "forms-select-menu"],
      ["spinbutton", "Quantity", "forms-number"],
      ["slider", "Score", "forms-rating"],
      ["slider", "Volume", "forms-slider"],
      ["radiogroup", "Radios", "forms-radios"],
      ["radiogroup", "Accent", "forms-accent"],
      ["button", "Browse files", "forms-dropzone"],
      ["button", "👍 1", "forms-reaction"],
    ];
    for (const [role, name, intent] of targets) {
      const element = await canvas.findByRole(role, { name });
      await expect(element).toHaveAttribute("data-intent", intent);
    }
    const itemTargets: [string, string, string][] = [
      ["button", "Chip Alpha", "forms-chips-item"],
      ["checkbox", "Check Alpha", "forms-checks-item"],
      ["radio", "Radio Alpha", "forms-radios-item"],
      ["radio", "Accent Alpha", "forms-accent-item"],
    ];
    for (const [role, name, intent] of itemTargets) {
      const element = await canvas.findByRole(role, { name });
      await expect(element).toHaveAttribute("data-intent", intent);
      await expect(element).toHaveAttribute("data-intent-key", "a");
    }
  },
};

export const ForwardsRefsAndKeepsChildRef: Story = {
  play: async () => {
    const fieldRef = createRef<HTMLDivElement>();
    const inputRef = createRef<HTMLInputElement>();
    const selectRef = createRef<HTMLSelectElement>();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    flushSync(() =>
      root.render(
        <>
          <Field ref={fieldRef} label="Name">
            <input ref={inputRef} />
          </Field>
          <Select ref={selectRef} aria-label="Kind" />
        </>,
      ),
    );
    await expect(fieldRef.current).toBeInstanceOf(HTMLDivElement);
    await expect(inputRef.current).toBeInstanceOf(HTMLInputElement);
    await expect(inputRef.current?.id).not.toBe("");
    await expect(selectRef.current).toBeInstanceOf(HTMLSelectElement);
    root.unmount();
    host.remove();
  },
};
