import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "../../utils/cn.js";

export interface SettingsRowProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  title: ReactNode;
  description?: ReactNode;
  /** Control on the right: a switch, a button, etc. */
  control?: ReactNode;
}

export function SettingsRow({
  title,
  description,
  control,
  className,
  ...props
}: SettingsRowProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 border-t-divider px-4 py-[13px] first:border-t-0",
        className,
      )}
      {...props}
    >
      <div className="min-w-0 flex-[1_1_14rem] break-words">
        <p className="font-semibold text-[13px]">{title}</p>
        {description ? <p className="max-w-[60ch] text-[12px] text-ink-3">{description}</p> : null}
      </div>
      {control ? <div className="flex max-w-full shrink-0 items-center">{control}</div> : null}
    </div>
  );
}
