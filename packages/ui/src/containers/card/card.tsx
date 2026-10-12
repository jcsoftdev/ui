import type { ComponentPropsWithoutRef, Ref } from "react";
import { useGlassLens } from "../../glass/use-glass-lens.js";
import { cn } from "../../utils/cn.js";
import { type Material, materialClass } from "../../utils/material.js";

export type CardProps = ComponentPropsWithoutRef<"div">;

export interface CardRootProps extends CardProps {
  /**
   * Cards are content, so they are opaque by default. `"glass"` or `"glass-clear"` opts one
   * into Liquid Glass (use sparingly, over imagery, never inside another glass surface).
   */
  material?: Material;
  ref?: Ref<HTMLDivElement>;
}

export function Card({ className, material, ref, ...props }: CardRootProps) {
  const lens = useGlassLens(ref);
  return (
    <div
      ref={lens}
      className={cn(
        "min-w-0 rounded-card border-card shadow-card surface-card @container/card",
        materialClass(material, "surface-card"),
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "flex min-h-12.5 flex-wrap items-center gap-2.5 border-b-divider px-card py-3",
        className,
      )}
      {...props}
    />
  );
}

export function CardBody({ className, ...props }: CardProps) {
  return <div className={cn("px-card py-3.5", className)} {...props} />;
}

export function CardFooter({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 border-t-divider px-card py-2.5 text-ink-3 text-meta",
        className,
      )}
      {...props}
    />
  );
}
