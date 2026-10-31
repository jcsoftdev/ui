import {
  type ComponentPropsWithoutRef,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { Kbd } from "../../atoms/kbd/kbd.js";
import { cn } from "../../utils/cn.js";
import { Slot } from "../../utils/slot.js";

export type ShortcutsProps = ComponentPropsWithoutRef<"ul">;

/** A short list of quick links or actions, flush to its container. Items go in `ShortcutsItem`. */
export function Shortcuts({ className, ...props }: ShortcutsProps) {
  return <ul className={cn("m-0 flex list-none flex-col gap-0.5 p-0", className)} {...props} />;
}

export interface ShortcutsItemProps extends ComponentPropsWithoutRef<"a"> {
  /** Decorative glyph before the label. */
  icon?: ReactNode;
  /** Keyboard hint at the end (`G P`, `⌘K`). */
  kbd?: string;
  /** Count or badge at the end. */
  count?: ReactNode;
  /**
   * Renders the single child element (a router `Link`, say) with the item's look instead of an
   * anchor. Without `href` and without `asChild` the item is a `<button>`.
   */
  asChild?: boolean;
}

const itemClasses =
  "flex min-h-control-sm w-full cursor-pointer items-center gap-2 rounded-button px-2 text-start text-fs-130 text-ink-2 no-underline hover:bg-surface-2 hover:text-ink focus-visible:focus-ring";

export function ShortcutsItem({
  icon,
  kbd,
  count,
  asChild = false,
  href,
  className,
  children,
  ...props
}: ShortcutsItemProps) {
  const content = (label: ReactNode) => (
    <>
      {icon !== undefined ? (
        <span aria-hidden="true" className="inline-flex shrink-0 text-ink-3 [&_svg]:size-4">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined ? (
        <span className="text-count text-ink-3 tabular-nums">{count}</span>
      ) : null}
      {kbd !== undefined ? <Kbd>{kbd}</Kbd> : null}
    </>
  );
  const classes = cn(itemClasses, className);

  if (asChild && isValidElement(children)) {
    const child = children as ReactElement<{ children?: ReactNode }>;
    return (
      <li>
        <Slot className={classes} {...props}>
          {cloneElement(child, undefined, content(child.props.children))}
        </Slot>
      </li>
    );
  }
  if (href === undefined && !asChild) {
    return (
      <li>
        <button
          type="button"
          className={classes}
          {...(props as unknown as ComponentPropsWithoutRef<"button">)}
        >
          {content(children)}
        </button>
      </li>
    );
  }
  return (
    <li>
      <a href={href} className={classes} {...props}>
        {content(children)}
      </a>
    </li>
  );
}
