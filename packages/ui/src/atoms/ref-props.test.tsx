import { createRef } from "react";
import { BigDate } from "./big-date/big-date.js";
import { Button } from "./button/button.js";
import { Checkbox } from "./checkbox/checkbox.js";
import { Chip } from "./chip/chip.js";
import { Divider } from "./divider/divider.js";
import { ElapsedTime } from "./elapsed-time/elapsed-time.js";
import { IconButton } from "./icon-button/icon-button.js";
import { NumberValue } from "./number-value/number-value.js";
import { PressableFeedback } from "./pressable-feedback/pressable-feedback.js";
import { Progress } from "./progress/progress.js";
import { RadioGroup } from "./radio-group/radio-group.js";
import { Seal } from "./seal/seal.js";
import { Switch } from "./switch/switch.js";
import { TableGlyph } from "./table-glyph/table-glyph.js";
import { TrendChip } from "./trend-chip/trend-chip.js";

const div = createRef<HTMLDivElement>();
const span = createRef<HTMLSpanElement>();
const time = createRef<HTMLTimeElement>();
const svg = createRef<SVGSVGElement>();
const button = createRef<HTMLButtonElement>();

export const RefForwarding = () => (
  <>
    <BigDate ref={div} />
    <Divider ref={div} />
    <ElapsedTime ref={time} since={new Date(0)} />
    <NumberValue ref={span} value={1} />
    <PressableFeedback ref={span} intent="probe" intentKey="k1" />
    <Progress ref={div} value={1} />
    <Seal ref={div} />
    <TableGlyph ref={svg} shape="round" seats={2} />
    <TrendChip ref={span} value={1} />
  </>
);

export const IntentProps = () => (
  <>
    <Button ref={button} intent="probe" intentKey="k1" />
    <IconButton ref={button} label="Close" intent="probe" intentKey="k1">
      <svg aria-hidden="true" />
    </IconButton>
    <Checkbox ref={button} intent="probe" intentKey="k1" />
    <Switch ref={button} intent="probe" intentKey="k1" />
    <Chip ref={span} intent="probe" intentKey="k1" />
    <RadioGroup options={[{ value: "a", label: "A", intent: "probe", intentKey: "k1" }]} />
  </>
);
