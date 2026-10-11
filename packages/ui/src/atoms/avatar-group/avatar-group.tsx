import type { ComponentPropsWithRef } from "react";
import { cn } from "../../utils/cn.js";

export type AvatarGroupProps = ComponentPropsWithRef<"div">;

/** Stacked, overlapping avatars separated by a surface-colored ring. */
export function AvatarGroup({ className, ...props }: AvatarGroupProps) {
  return (
    <div
      {...props}
      className={cn("flex [&>*+*]:-ml-1.5 [&>*]:shadow-[0_0_0_2px_var(--surface)]", className)}
    />
  );
}
