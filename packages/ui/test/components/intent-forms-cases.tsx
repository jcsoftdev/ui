import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AccentPicker } from "../../src/forms/accent-picker/index.js";
import { CheckboxButtonGroup } from "../../src/forms/checkbox-button-group/index.js";
import { ChipGroup } from "../../src/forms/chip-group/index.js";
import { Combobox } from "../../src/forms/combobox/index.js";
import { CopyField } from "../../src/forms/copy-field/index.js";
import { DatePicker, DateTimePicker } from "../../src/forms/date-picker/index.js";
import { Dropzone } from "../../src/forms/dropzone/index.js";
import { EmojiPicker } from "../../src/forms/emoji-picker/index.js";
import { EmojiReactionButton } from "../../src/forms/emoji-reaction-button/index.js";
import { Form } from "../../src/forms/form/index.js";
import { InlineSelect } from "../../src/forms/inline-select/index.js";
import { Input } from "../../src/forms/input/index.js";
import { InputIcon } from "../../src/forms/input-icon/index.js";
import { NativeSelect } from "../../src/forms/native-select/index.js";
import { NumberStepper } from "../../src/forms/number-stepper/index.js";
import { PasswordInput } from "../../src/forms/password-input/index.js";
import { PinInput } from "../../src/forms/pin-input/index.js";
import { RadioButtonGroup } from "../../src/forms/radio-button-group/index.js";
import { Rating } from "../../src/forms/rating/index.js";
import { Select } from "../../src/forms/select/index.js";
import { SelectMenu } from "../../src/forms/select-menu/index.js";
import { Slider } from "../../src/forms/slider/index.js";
import { Textarea } from "../../src/forms/textarea/index.js";
import { TimeInput } from "../../src/forms/time-input/index.js";

interface Expected {
  tag: string;
  role?: string;
  intent: string;
  key: string;
}

interface IntentCase {
  name: string;
  element: ReactElement;
  expected: Expected[];
}

const probe = (tag: string, role?: string, key = "k1"): Expected => ({
  tag,
  intent: "probe",
  key,
  ...(role ? { role } : {}),
});

const item = (tag: string, key: string, role?: string): Expected => ({
  tag,
  intent: "item",
  key,
  ...(role ? { role } : {}),
});

const options = [
  { value: "a", label: "A" },
  { value: "b", label: "B" },
];

const itemOptions = [
  { value: "a", label: "A", intent: "item" },
  { value: "b", label: "B", intent: "item", intentKey: "custom" },
];

const swatchOptions = [
  { value: "a", label: "A", swatch: "red", intent: "item" },
  { value: "b", label: "B", swatch: "blue", intent: "item", intentKey: "custom" },
];

const intent = { intent: "probe", intentKey: "k1" };
const named = { "aria-label": "Field" };

export const intentCases: IntentCase[] = [
  { name: "Input", element: <Input {...named} {...intent} />, expected: [probe("input")] },
  {
    name: "Input with adornment",
    element: <Input {...named} {...intent} start="$" />,
    expected: [probe("input")],
  },
  {
    name: "InputIcon",
    element: <InputIcon {...named} {...intent} icon="@" />,
    expected: [probe("input")],
  },
  {
    name: "PasswordInput",
    element: <PasswordInput {...named} {...intent} />,
    expected: [probe("input")],
  },
  { name: "Textarea", element: <Textarea {...named} {...intent} />, expected: [probe("textarea")] },
  {
    name: "Select",
    element: <Select {...named} {...intent} />,
    expected: [probe("select")],
  },
  {
    name: "NativeSelect",
    element: <NativeSelect {...named} {...intent} options={options} />,
    expected: [probe("select")],
  },
  {
    name: "InlineSelect",
    element: <InlineSelect {...named} {...intent} options={options} />,
    expected: [probe("select")],
  },
  { name: "Form", element: <Form {...intent} />, expected: [probe("form")] },
  {
    name: "Combobox",
    element: <Combobox {...named} {...intent} options={options} />,
    expected: [probe("input", "combobox")],
  },
  {
    name: "SelectMenu",
    element: <SelectMenu {...named} {...intent} options={options} />,
    expected: [probe("button", "combobox")],
  },
  { name: "DatePicker", element: <DatePicker {...named} {...intent} />, expected: [probe("input")] },
  {
    name: "DateTimePicker",
    element: <DateTimePicker {...named} {...intent} />,
    expected: [probe("div")],
  },
  { name: "TimeInput", element: <TimeInput {...named} {...intent} />, expected: [probe("input")] },
  {
    name: "NumberStepper",
    element: <NumberStepper {...named} {...intent} />,
    expected: [probe("input", "spinbutton")],
  },
  {
    name: "Slider",
    element: <Slider {...named} {...intent} />,
    expected: [probe("span", "slider")],
  },
  {
    name: "Slider range",
    element: <Slider {...named} {...intent} defaultValue={[10, 20]} />,
    expected: [probe("span", "slider", "k1-min"), probe("span", "slider", "k1-max")],
  },
  {
    name: "Rating editable",
    element: <Rating {...named} {...intent} />,
    expected: [probe("div", "slider")],
  },
  {
    name: "Rating read-only",
    element: <Rating {...named} {...intent} readOnly />,
    expected: [probe("div", "img")],
  },
  { name: "PinInput", element: <PinInput {...intent} />, expected: [probe("input")] },
  {
    name: "ChipGroup",
    element: <ChipGroup {...named} {...intent} options={itemOptions} />,
    expected: [probe("fieldset"), item("button", "a"), item("button", "custom")],
  },
  {
    name: "CheckboxButtonGroup",
    element: <CheckboxButtonGroup {...named} {...intent} options={itemOptions} />,
    expected: [probe("fieldset"), item("input", "a"), item("input", "custom")],
  },
  {
    name: "RadioButtonGroup",
    element: <RadioButtonGroup {...named} {...intent} options={itemOptions} />,
    expected: [probe("div", "radiogroup"), item("input", "a"), item("input", "custom")],
  },
  {
    name: "AccentPicker",
    element: <AccentPicker {...named} {...intent} options={swatchOptions} />,
    expected: [probe("div", "radiogroup"), item("button", "a"), item("button", "custom")],
  },
  {
    name: "Dropzone zone",
    element: <Dropzone {...intent} onFiles={() => undefined} title="Drop" browseLabel="Browse" />,
    expected: [probe("button")],
  },
  {
    name: "Dropzone field",
    element: (
      <Dropzone
        {...named}
        {...intent}
        mode="field"
        onFiles={() => undefined}
        title="Drop"
        browseLabel="Browse"
      />
    ),
    expected: [probe("input")],
  },
  {
    name: "CopyField",
    element: <CopyField {...intent} label="Link" value="x" />,
    expected: [probe("div")],
  },
  { name: "EmojiPicker", element: <EmojiPicker {...intent} />, expected: [probe("div", "group")] },
  {
    name: "EmojiReactionButton",
    element: <EmojiReactionButton {...intent} emoji="x" count={1} />,
    expected: [probe("button")],
  },
];

export const render = (element: ReactElement): string => renderToStaticMarkup(element);

export const bareCases: { name: string; element: ReactElement }[] = [
  { name: "Input", element: <Input aria-label="Field" intent="" intentKey="k1" /> },
  { name: "Select", element: <Select aria-label="Field" intentKey="k1" /> },
  { name: "Slider", element: <Slider aria-label="Field" intent="" intentKey="k1" /> },
  { name: "ChipGroup", element: <ChipGroup aria-label="Field" intentKey="k1" options={options} /> },
];
