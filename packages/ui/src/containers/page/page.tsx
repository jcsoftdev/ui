import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react";
import { cn } from "../../utils/cn.js";

export interface PageProps extends ComponentPropsWithoutRef<"div"> {
  /**
   * A fixed column beside the page content, usually an `Aside`. The column draws a divider and the
   * page background, never narrows the width the `page` container measures (so `Cols` inside the
   * content react the same with or without it), and falls under the content once the page is
   * 1000px wide or less. With an aside, `className` and the other props apply to the content column.
   */
  aside?: ReactNode;
  /** Width of the aside column: a number is pixels, a string any CSS length. Default `20rem` (320px at 16px). */
  asideWidth?: number | string;
  /** Keeps the aside column in view and scrolls it on its own beside the content (above 1000px). */
  asideSticky?: boolean;
}

const CONTENT = "flex w-full min-w-0 flex-col gap-6";

/**
 * Vertical flow of page sections. It is the `page` container, so `Cols` and `SettingsLayout`
 * inside it react to the page width instead of the viewport. With `aside` the page is a content
 * column plus a rail; the shell around the page still owns the outer gutter and scrolling.
 */
export function Page({
  aside,
  asideWidth,
  asideSticky = false,
  className,
  style,
  children,
  ...props
}: PageProps) {
  if (aside === undefined) {
    return (
      <div className={cn("@container/page", CONTENT, className)} style={style} {...props}>
        {children}
      </div>
    );
  }
  const width =
    asideWidth === undefined
      ? undefined
      : typeof asideWidth === "number"
        ? `${asideWidth}px`
        : asideWidth;
  return (
    <div
      data-page-aside=""
      className="@container/page w-full min-w-0"
      style={width === undefined ? undefined : ({ "--page-aside-width": width } as CSSProperties)}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_var(--page-aside-width,20rem)] items-start @max-[1000px]/page:grid-cols-[minmax(0,1fr)]">
        <div className={cn(CONTENT, className)} style={style} {...props}>
          {children}
        </div>
        <div
          data-page-rail=""
          className={cn(
            "flex min-w-0 flex-col self-stretch border-l-divider bg-surface",
            "@max-[1000px]/page:border-t-divider @max-[1000px]/page:border-l-0",
            asideSticky &&
              "@min-[1001px]/page:sticky @min-[1001px]/page:top-0 @min-[1001px]/page:max-h-dvh @min-[1001px]/page:self-start @min-[1001px]/page:overflow-y-auto",
          )}
        >
          {aside}
        </div>
      </div>
    </div>
  );
}
