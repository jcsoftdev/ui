import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "../../src/atoms/button/button.js";
import { Chip } from "../../src/atoms/chip/chip.js";
import { IconButton } from "../../src/atoms/icon-button/icon-button.js";
import { ChipGroup } from "../../src/forms/chip-group/chip-group.js";
import { Combobox } from "../../src/forms/combobox/combobox.js";
import { DatePicker } from "../../src/forms/date-picker/date-picker.js";
import { DateTimePicker } from "../../src/forms/date-picker/date-time-picker.js";
import { Input } from "../../src/forms/input/input.js";
import { Select } from "../../src/forms/select/select.js";
import { TimeInput } from "../../src/forms/time-input/time-input.js";

type Size = "sm" | "md";

const OPTIONS = [{ value: "a", label: "A" }];

export const html = {
  button: (size?: Size) => renderToStaticMarkup(<Button size={size}>Save</Button>),
  iconButton: (size?: Size) =>
    renderToStaticMarkup(
      <IconButton label="More" size={size}>
        <svg />
      </IconButton>,
    ),
  input: (size?: Size) => renderToStaticMarkup(<Input aria-label="Name" size={size} />),
  select: (size?: Size) =>
    renderToStaticMarkup(
      <Select aria-label="Status" size={size}>
        <option>A</option>
      </Select>,
    ),
  combobox: (size?: Size) =>
    renderToStaticMarkup(<Combobox aria-label="Person" options={OPTIONS} size={size} />),
  datePicker: (size?: Size) =>
    renderToStaticMarkup(<DatePicker aria-label="Date" size={size} defaultValue="2026-03-01" />),
  timeInput: (size?: Size) => renderToStaticMarkup(<TimeInput aria-label="Time" size={size} />),
  dateTimePicker: (size?: Size, classNames?: Record<string, string>) =>
    renderToStaticMarkup(
      <DateTimePicker
        aria-label="When"
        size={size}
        defaultValue="2026-03-01T09:30"
        classNames={classNames}
      />,
    ),
  chipGroup: (size?: Size) =>
    renderToStaticMarkup(
      <ChipGroup
        aria-label="Status"
        size={size}
        options={[
          { value: "open", label: "Open" },
          { value: "closed", label: "Closed" },
        ]}
      />,
    ),
  chip: (props: Record<string, unknown> = {}) => renderToStaticMarkup(<Chip {...props}>Paid</Chip>),
};
