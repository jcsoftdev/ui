"use client";

import { type ReactNode, useId } from "react";
import { Switch } from "../../atoms/switch/switch.js";
import { type AccentOption, AccentPicker } from "../../forms/accent-picker/accent-picker.js";
import { NativeSelect, type NativeSelectOption } from "../../forms/native-select/native-select.js";
import { Slider } from "../../forms/slider/slider.js";
import { SettingsRow, type SettingsRowProps } from "../settings-row/settings-row.js";

interface CellBase extends Omit<SettingsRowProps, "control" | "onChange" | "defaultValue"> {
  disabled?: boolean;
}

export interface SwitchCellProps extends CellBase {
  variant: "switch";
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export interface SelectCellProps extends CellBase {
  variant: "select";
  options: NativeSelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

export interface SliderCellProps extends CellBase {
  variant: "slider";
  min?: number;
  max?: number;
  step?: number;
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  formatValue?: (value: number) => string;
}

export interface ColorCellProps extends CellBase {
  variant: "color";
  colors: AccentOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

export type CellProps = SwitchCellProps | SelectCellProps | SliderCellProps | ColorCellProps;

/**
 * Settings-list row with a ready-made control. It extends `SettingsRow` (same layout, divider and
 * wrapping) and fills its `control` slot with a switch, native select, slider or color picker, wiring
 * the row title as the control's accessible name.
 */
export function Cell(props: CellProps) {
  const labelId = useId();
  const { title, description, className, disabled } = props;

  let control: ReactNode;
  switch (props.variant) {
    case "switch":
      control = (
        <Switch
          aria-labelledby={labelId}
          disabled={disabled}
          checked={props.checked}
          defaultChecked={props.defaultChecked}
          onCheckedChange={props.onCheckedChange}
        />
      );
      break;
    case "select":
      control = (
        <div className="w-44 max-w-full">
          <NativeSelect
            aria-labelledby={labelId}
            size="sm"
            disabled={disabled}
            options={props.options}
            value={props.value}
            defaultValue={props.defaultValue}
            onChange={(event) => props.onValueChange?.(event.target.value)}
          />
        </div>
      );
      break;
    case "slider":
      control = (
        <div className="flex w-56 max-w-full items-center gap-density">
          <Slider
            aria-labelledby={labelId}
            disabled={disabled}
            min={props.min}
            max={props.max}
            step={props.step}
            value={props.value}
            defaultValue={props.defaultValue ?? props.min ?? 0}
            onValueChange={props.onValueChange}
            formatValue={props.formatValue}
          />
        </div>
      );
      break;
    case "color":
      control = (
        <AccentPicker
          aria-labelledby={labelId}
          disabled={disabled}
          options={props.colors}
          value={props.value}
          defaultValue={props.defaultValue}
          onValueChange={props.onValueChange}
        />
      );
      break;
  }

  return (
    <SettingsRow
      title={title}
      description={description}
      className={className}
      titleId={labelId}
      control={control}
    />
  );
}
