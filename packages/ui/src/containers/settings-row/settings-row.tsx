import type { ComponentPropsWithoutRef, ReactNode } from "react";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";

export type SettingsRowPart = "root" | "body" | "title" | "description" | "control";

export interface SettingsRowProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  title: ReactNode;
  description?: ReactNode;
  /** Control on the right: a switch, a button, etc. */
  control?: ReactNode;
  /** Id for the title element, so the control can reference it with `aria-labelledby`. */
  titleId?: string;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root. */
  classNames?: ClassNames<SettingsRowPart>;
}

export function SettingsRow({
  title,
  description,
  control,
  titleId,
  className,
  classNames,
  ...props
}: SettingsRowProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 border-t-divider px-4 py-3.25 first:border-t-0",
        className,
        classNames?.root,
      )}
      {...props}
    >
      <div className={cn("min-w-0 flex-[1_1_14rem] break-words", classNames?.body)}>
        <p id={titleId} className={cn("font-semibold text-fs-130", classNames?.title)}>
          {title}
        </p>
        {description ? (
          <p className={cn("max-w-[60ch] text-fs-120 text-ink-3", classNames?.description)}>
            {description}
          </p>
        ) : null}
      </div>
      {control ? (
        <div className={cn("flex max-w-full shrink-0 items-center", classNames?.control)}>
          {control}
        </div>
      ) : null}
    </div>
  );
}
