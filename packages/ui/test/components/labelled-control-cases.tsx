import { renderToStaticMarkup } from "react-dom/server";
import { Checkbox } from "../../src/atoms/checkbox/checkbox.js";
import { Switch } from "../../src/atoms/switch/switch.js";

export const html = {
  checkboxLabelled: renderToStaticMarkup(<Checkbox id="cb" label="Agree" />),
  checkboxLabelledDisabled: renderToStaticMarkup(<Checkbox id="cb" label="Agree" disabled />),
  checkboxBare: renderToStaticMarkup(<Checkbox id="cb" aria-label="Agree" />),
  switchBare: renderToStaticMarkup(<Switch id="sw" aria-label="Notify" />),
  switchLabelled: renderToStaticMarkup(<Switch id="sw" label="Notify" />),
  switchGeneratedId: renderToStaticMarkup(<Switch label="Notify" />),
  switchDescribed: renderToStaticMarkup(
    <Switch id="sw" label="Notify" description="One day before" />,
  ),
  switchDescribedConsumer: renderToStaticMarkup(
    <Switch id="sw" aria-describedby="err" label="Notify" description="One day before" />,
  ),
  switchDescriptionOnly: renderToStaticMarkup(
    <Switch id="sw" aria-label="Notify" description="One day before" />,
  ),
  checkboxDescribed: renderToStaticMarkup(
    <Checkbox id="cb" label="Agree" description="Required to continue" />,
  ),
  checkboxDescribedConsumer: renderToStaticMarkup(
    <Checkbox id="cb" aria-describedby="err" label="Agree" description="Required to continue" />,
  ),
  switchParts: renderToStaticMarkup(
    <Switch
      id="sw"
      label="Notify"
      description="One day before"
      classNames={{ wrapper: "w-x", label: "l-x", description: "d-x" }}
    />,
  ),
  checkboxParts: renderToStaticMarkup(
    <Checkbox
      id="cb"
      label="Agree"
      description="Required"
      classNames={{ wrapper: "w-x", label: "l-x", description: "d-x" }}
    />,
  ),
};
