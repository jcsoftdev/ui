import type { ReactNode } from "react";
import { cn } from "../../utils/cn.js";
import { Input, type InputProps } from "../input/index.js";

export interface InputIconProps extends InputProps {
  /** Leading icon element (e.g. a lucide-react icon). */
  icon: ReactNode;
}

export function InputIcon({ icon, className, ...props }: InputIconProps) {
  return (
    <span className="relative flex w-full items-center">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-2.5 flex text-ink-3 [&>svg]:size-4"
      >
        {icon}
      </span>
      <Input className={cn("pl-8", className)} {...props} />
    </span>
  );
}
