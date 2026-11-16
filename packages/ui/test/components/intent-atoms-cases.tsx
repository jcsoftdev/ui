import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "../../src/atoms/button/button.js";
import { Checkbox } from "../../src/atoms/checkbox/checkbox.js";
import { Chip } from "../../src/atoms/chip/chip.js";
import { IconButton } from "../../src/atoms/icon-button/icon-button.js";
import { PressableFeedback } from "../../src/atoms/pressable-feedback/pressable-feedback.js";
import { RadioGroup } from "../../src/atoms/radio-group/radio-group.js";
import { Switch } from "../../src/atoms/switch/switch.js";

const probe = { intent: "probe", intentKey: "k1" };

export const html = {
  button: renderToStaticMarkup(<Button {...probe}>Save</Button>),
  buttonLink: renderToStaticMarkup(
    <Button asChild {...probe}>
      <a href="/x">Open</a>
    </Button>,
  ),
  buttonOverride: renderToStaticMarkup(
    <Button {...probe} data-intent="mine">
      Save
    </Button>,
  ),
  buttonPlain: renderToStaticMarkup(<Button>Save</Button>),
  buttonEmptyIntent: renderToStaticMarkup(
    <Button intent="" intentKey="k1">
      Save
    </Button>,
  ),
  iconButton: renderToStaticMarkup(
    <IconButton label="Close" {...probe}>
      <svg aria-hidden="true" />
    </IconButton>,
  ),
  checkbox: renderToStaticMarkup(<Checkbox aria-label="Agree" {...probe} />),
  switch: renderToStaticMarkup(<Switch aria-label="Notify" {...probe} />),
  radioGroup: renderToStaticMarkup(
    <RadioGroup
      options={[
        { value: "a", label: "A", intent: "pick-a" },
        { value: "b", label: "B", intent: "pick-b", intentKey: "custom" },
        { value: "c", label: "C" },
      ]}
    />,
  ),
  chip: renderToStaticMarkup(
    <Chip onClick={() => undefined} {...probe}>
      Tag
    </Chip>,
  ),
  pressableFeedback: renderToStaticMarkup(
    <PressableFeedback {...probe}>
      <b>x</b>
    </PressableFeedback>,
  ),
};
