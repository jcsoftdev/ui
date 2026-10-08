import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../../utils/cn.js";

export type ToolbarProps = ComponentPropsWithoutRef<"div">;

/** Row of filters/controls above a table or grid. */
export function Toolbar({ className, ...props }: ToolbarProps) {
  return <div className={cn("flex min-w-0 flex-wrap items-center gap-2", className)} {...props} />;
}

export type ToolbarRightProps = ComponentPropsWithoutRef<"div">;

/** Group pushed to the right edge of the toolbar. */
export function ToolbarRight({ className, ...props }: ToolbarRightProps) {
  return (
    <div
      className={cn("ml-auto flex min-w-0 flex-wrap items-center gap-2", className)}
      {...props}
    />
  );
}
