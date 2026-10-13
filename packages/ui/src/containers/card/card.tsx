import type { ComponentPropsWithoutRef, ReactNode, Ref } from "react";
import { cn } from "../../utils/cn.js";
import { type Material, materialClass } from "../../utils/material.js";

export type CardProps = ComponentPropsWithoutRef<"div">;

export interface CardRootProps extends CardProps {
  ref?: Ref<HTMLDivElement>;
  /**
   * Cards are content, so they are opaque by default. `"glass"` and `"glass-clear"` opt one into
   * frosted glass, `"liquid"` and `"liquid-clear"` into Liquid Glass (use sparingly, over imagery,
   * never inside another glass surface). Liquid options go in `style` (`liquidStyle()` from
   * `@jcsoftdev/ui/liquid`); the lens needs `<LiquidGlass />` mounted once.
   */
  material?: Material;
}

export function Card({ className, material, ...props }: CardRootProps) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-card border-card shadow-card surface-card @container/card",
        materialClass(material, "surface-card"),
        className,
      )}
      {...props}
    />
  );
}

export interface CardHeaderProps extends Omit<CardProps, "title"> {
  /** Decorative icon before the title; hidden from screen readers. */
  icon?: ReactNode;
  title?: ReactNode;
  /** End slot, e.g. a link or an icon button. */
  action?: ReactNode;
}

export function CardHeader({
  className,
  icon,
  title,
  action,
  children,
  ...props
}: CardHeaderProps) {
  return (
    <div
      className={cn(
        "flex min-h-12.5 flex-wrap items-center gap-2.5 border-b-divider px-card py-3",
        className,
      )}
      {...props}
    >
      {icon ? (
        <span aria-hidden="true" className="inline-flex shrink-0 text-ink-3 [&_svg]:size-4.5">
          {icon}
        </span>
      ) : null}
      {title ? (
        <div className="min-w-0 break-words font-semibold text-ink text-body">{title}</div>
      ) : null}
      {children}
      {action ? <div className="ml-auto flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
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
