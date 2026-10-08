import type { ReactNode } from "react";
import { cn } from "../../utils/cn.js";

export interface AvatarGroupProps {
  children?: ReactNode;
  className?: string;
}

/** Stacked, overlapping avatars separated by a surface-colored ring. */
export function AvatarGroup({ children, className }: AvatarGroupProps) {
  return (
    <div className={cn("flex [&>*+*]:-ml-1.5 [&>*]:shadow-[0_0_0_2px_var(--surface)]", className)}>
      {children}
    </div>
  );
}
