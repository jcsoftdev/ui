import type { ComponentPropsWithoutRef, ReactNode } from "react";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";

export type DividerPart = "root" | "line" | "label";

export interface DividerProps extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
  /** Text centered on the rule. Without it the divider is a plain hairline. */
  children?: ReactNode;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<DividerPart>;
}

/**
 * Horizontal rule, optionally carrying a short label ("or", "with your account"). It is a
 * separator for assistive technology, so the label is read as part of the separator's name
 * rather than as page content.
 */
export function Divider({ children, className, classNames, ...props }: DividerProps) {
  const labelled = children !== undefined && children !== null && children !== false;
  const line = cn("h-px min-w-0 flex-1 bg-line", classNames?.line);
  return (
    // biome-ignore lint/a11y/useSemanticElements: an <hr> cannot carry the label between the two rules
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label={labelled && typeof children === "string" ? children : undefined}
      {...props}
      className={cn("flex items-center gap-3 text-ink-3 text-meta", classNames?.root, className)}
    >
      <span aria-hidden="true" className={line} />
      {labelled ? (
        <span aria-hidden="true" className={cn("shrink-0", classNames?.label)}>
          {children}
        </span>
      ) : null}
      {labelled ? <span aria-hidden="true" className={line} /> : null}
    </div>
  );
}
