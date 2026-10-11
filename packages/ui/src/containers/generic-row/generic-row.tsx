import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../../utils/cn.js";

export type GenericRowProps = ComponentPropsWithoutRef<"div">;

/**
 * Generic 3-column row (start / flexible content / end) for heterogeneous
 * lists. The start and end slots take any content (icon, avatar, chip,
 * button). No top border on the first row of a consecutive list.
 */
export function GenericRow({ className, ...props }: GenericRowProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-t-divider px-4 py-2.75 first:border-t-0",
        className,
      )}
      {...props}
    />
  );
}

export type GenericRowContentProps = ComponentPropsWithoutRef<"div">;

/** Flexible middle column wrapping title and meta. */
export function GenericRowContent({ className, ...props }: GenericRowContentProps) {
  return <div className={cn("min-w-0", className)} {...props} />;
}

export type GenericRowTitleProps = ComponentPropsWithoutRef<"div">;

export function GenericRowTitle({ className, ...props }: GenericRowTitleProps) {
  return <div className={cn("break-words font-[650] text-fs-130", className)} {...props} />;
}

export type GenericRowMetaProps = ComponentPropsWithoutRef<"div">;

/** Secondary metadata under the title. */
export function GenericRowMeta({ className, ...props }: GenericRowMetaProps) {
  return <div className={cn("break-words text-fs-120 text-ink-3", className)} {...props} />;
}
