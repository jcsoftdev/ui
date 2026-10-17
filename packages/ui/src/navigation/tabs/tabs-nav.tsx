"use client";

import {
  type AnchorHTMLAttributes,
  type ComponentPropsWithoutRef,
  cloneElement,
  createContext,
  isValidElement,
  type ReactElement,
  type ReactNode,
  type Ref,
  useContext,
} from "react";
import { cn } from "../../utils/cn.js";
import { Slot } from "../../utils/slot.js";

/** Props handed to `renderLink`: spread them on your router's link component. */
export interface TabsNavLinkRenderProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  ref?: Ref<HTMLAnchorElement>;
  "aria-current"?: "page" | undefined;
  "data-active"?: "" | undefined;
}

interface TabsNavContextValue {
  value: string | undefined;
  renderLink: ((props: TabsNavLinkRenderProps) => ReactNode) | undefined;
}

const TabsNavContext = createContext<TabsNavContextValue>({
  value: undefined,
  renderLink: undefined,
});

export interface TabsNavProps extends ComponentPropsWithoutRef<"nav"> {
  /** Name of the strip (required: a page can have several navigations). */
  "aria-label": string;
  /** Value of the item that is the current page. */
  value?: string | undefined;
  /**
   * Renders every link with your router's component instead of an `<a>`:
   * `renderLink={(props) => <Link to={...} {...props} />}`. An item's own `asChild` wins.
   */
  renderLink?: ((props: TabsNavLinkRenderProps) => ReactNode) | undefined;
}

/**
 * Tab-looking sub-navigation made of links. Unlike `Tabs` it has no panels and no tab roles:
 * each item is a real link, the current one carries `aria-current="page"`, and the router is
 * yours (`href`, `renderLink` or `asChild`). The strip is flush to its container's inline edges
 * and scrolls sideways when the items do not fit.
 */
export function TabsNav({ value, renderLink, className, children, ...props }: TabsNavProps) {
  return (
    <TabsNavContext.Provider value={{ value, renderLink }}>
      <nav {...props} className={cn("@container/tabs-nav min-w-0", className)}>
        <ul className="m-0 flex list-none gap-0.5 overflow-x-auto overscroll-x-contain border-b-divider p-0">
          {children}
        </ul>
      </nav>
    </TabsNavContext.Provider>
  );
}

export interface TabsNavLinkProps extends Omit<ComponentPropsWithoutRef<"a">, "children"> {
  /** Matches the strip's `value` to mark this item as the current page. */
  value: string;
  /** Overrides the match for routers that report the active state themselves. */
  active?: boolean | undefined;
  /** Optional record count shown after the label. */
  count?: number | undefined;
  /** Renders the single child element (a router `Link`) with the item's look and a11y props. */
  asChild?: boolean | undefined;
  children: ReactNode;
}

const itemClasses =
  "inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-2.5 @max-[420px]/tabs-nav:px-2 pt-2.75 pb-2.5 text-control text-ink-3 no-underline hover:text-ink focus-visible:-outline-offset-2 aria-[current=page]:border-accent-word aria-[current=page]:text-ink";

export function TabsNavLink({
  value,
  active,
  count,
  asChild = false,
  className,
  children,
  ...props
}: TabsNavLinkProps) {
  const context = useContext(TabsNavContext);
  const isActive = active ?? (context.value !== undefined && context.value === value);
  const shared = {
    ...props,
    "aria-current": isActive ? ("page" as const) : undefined,
    "data-active": isActive ? ("" as const) : undefined,
    className: cn(itemClasses, className),
  };
  const countNode =
    count !== undefined ? <span className="text-count text-ink-3">{count}</span> : null;

  if (asChild && isValidElement(children)) {
    const child = children as ReactElement<{ children?: ReactNode }>;
    return (
      <li>
        <Slot {...shared}>
          {cloneElement(
            child,
            undefined,
            <>
              {child.props.children}
              {countNode}
            </>,
          )}
        </Slot>
      </li>
    );
  }
  const content = (
    <>
      {children}
      {countNode}
    </>
  );
  return (
    <li>
      {context.renderLink ? (
        context.renderLink({ ...shared, children: content })
      ) : (
        <a {...shared}>{content}</a>
      )}
    </li>
  );
}
