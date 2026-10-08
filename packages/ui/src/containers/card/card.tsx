import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../../utils/cn.js";

export type CardProps = ComponentPropsWithoutRef<"div">;

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn("min-w-0 rounded-card bg-surface shadow-flat @container/card", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "flex min-h-[50px] flex-wrap items-center gap-2.5 border-line border-b px-4 py-3",
        className,
      )}
      {...props}
    />
  );
}

export function CardBody({ className, ...props }: CardProps) {
  return <div className={cn("px-4 py-3.5", className)} {...props} />;
}

export function CardFooter({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 border-line border-t px-4 py-2.5 text-ink-3 text-meta",
        className,
      )}
      {...props}
    />
  );
}
