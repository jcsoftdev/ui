import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../../utils/cn.js";

export type PageProps = ComponentPropsWithoutRef<"div">;

/**
 * Vertical flow of page sections. It is the `page` container, so `Cols` and `SettingsLayout`
 * inside it react to the page width instead of the viewport.
 */
export function Page({ className, ...props }: PageProps) {
  return (
    <div
      className={cn("@container/page flex w-full min-w-0 flex-col gap-6", className)}
      {...props}
    />
  );
}
