import type { ReactElement, ReactNode } from "react";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";

export type LabelledControlPart = "wrapper" | "label" | "description";

export interface LabelledControlProps {
  control: ReactNode;
  controlId: string | undefined;
  label: ReactNode;
  description: ReactNode;
  descriptionId: string;
  disabled: boolean | undefined;
  classNames: ClassNames<LabelledControlPart> | undefined;
}

const labelClasses =
  "cursor-pointer select-none text-control text-ink data-disabled:cursor-not-allowed data-disabled:opacity-50";

function describedBy(
  consumerIds: string | undefined,
  descriptionId: string,
  description: ReactNode,
): string | undefined {
  if (description === undefined) return consumerIds;
  return consumerIds ? `${consumerIds} ${descriptionId}` : descriptionId;
}

export function describedByProps(
  consumerIds: string | undefined,
  descriptionId: string,
  description: ReactNode,
): { "aria-describedby"?: string } {
  if (description === undefined) return {};
  return { "aria-describedby": describedBy(consumerIds, descriptionId, description) };
}

export function LabelledControl({
  control,
  controlId,
  label,
  description,
  descriptionId,
  disabled,
  classNames,
}: LabelledControlProps): ReactElement {
  const disabledAttr = disabled ? "" : undefined;
  const labelElement =
    label === undefined ? null : (
      <label
        htmlFor={controlId}
        data-disabled={disabledAttr}
        className={cn(labelClasses, classNames?.label)}
      >
        {label}
      </label>
    );

  if (description === undefined) {
    return (
      <span className={cn("inline-flex items-center", classNames?.wrapper)}>
        {control}
        {labelElement}
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center", classNames?.wrapper)}>
      {control}
      <span className="flex min-w-0 flex-col">
        {labelElement}
        <span
          id={descriptionId}
          data-disabled={disabledAttr}
          className={cn("text-ink-3 text-fs-120 data-disabled:opacity-50", classNames?.description)}
        >
          {description}
        </span>
      </span>
    </span>
  );
}
