import type { ComponentPropsWithoutRef, Ref } from "react";
import { cn } from "../../utils/cn.js";
import { type Material, materialClass } from "../../utils/material-class.js";
import { CardLens } from "./card-lens.js";

export type CardProps = ComponentPropsWithoutRef<"div">;

export interface CardRootProps extends CardProps {
  /**
   * Cards are content, so they are opaque by default. `"glass"` or `"glass-clear"` opts one
   * into Liquid Glass (use sparingly, over imagery, never inside another glass surface).
   */
  material?: Material;
  ref?: Ref<HTMLDivElement>;
}

const GLASS_CLASS = /(?:^|\s)(?:glass|glass-clear|liquid|liquid-clear)(?:\s|$)/;

/**
 * A server component. Only a glass card (a glass `material`, or a glass utility in `className`)
 * renders through the client `CardLens`, which gives it its lens and the variables of a liquid
 * material object; every other card ships no JS.
 */
export function Card({ className, material, style, ref, ...props }: CardRootProps) {
  const classes = cn(
    "min-w-0 rounded-card border-card shadow-card surface-card @container/card",
    materialClass(material, "surface-card"),
    className,
  );
  const glass = (material !== undefined && material !== "solid") || GLASS_CLASS.test(classes);
  return glass ? (
    <CardLens ref={ref} material={material} className={classes} style={style} {...props} />
  ) : (
    <div ref={ref} className={classes} style={style} {...props} />
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
