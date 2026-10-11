import type { ReactNode } from "react";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { Input, type InputProps } from "../input/index.js";

export type InputIconPart = "root" | "icon" | "input";

export interface InputIconProps extends InputProps {
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the input. */
  classNames?: ClassNames<InputIconPart>;
  /** Leading icon element (e.g. an `@jcsoftdev/ui/icons` icon). */
  icon: ReactNode;
}

export function InputIcon({ icon, className, classNames, ...props }: InputIconProps) {
  return (
    <span className={cn("relative flex w-full items-center", classNames?.root)}>
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute left-2.5 flex text-ink-3 [&>svg]:size-4",
          classNames?.icon,
        )}
      >
        {icon}
      </span>
      <Input className={cn("pl-8", className, classNames?.input)} {...props} />
    </span>
  );
}
