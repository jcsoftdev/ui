import type { ReactNode } from "react";
import { Banner } from "../../containers/banner/index.js";

export interface OfflineBannerProps {
  /** Number of changes queued while waiting to reconnect. */
  queuedChanges?: number;
  /** Screen reader text for the queue counter. */
  queuedLabel?: string;
  message: ReactNode;
  /** Optional action next to the message, e.g. a retry `Button`. Shown after the queue counter. */
  action?: ReactNode;
  className?: string;
}

export function OfflineBanner({
  queuedChanges = 0,
  queuedLabel,
  message,
  action,
  className,
}: OfflineBannerProps) {
  return (
    <Banner
      tone="warning"
      className={className}
      action={
        queuedChanges > 0 || action ? (
          <>
            {queuedChanges > 0 ? (
              <span className="font-semibold text-fs-120 tabular-nums">
                <span aria-hidden="true">{queuedChanges}</span>
                <span className="sr-only">{queuedLabel ?? String(queuedChanges)}</span>
              </span>
            ) : null}
            {action}
          </>
        ) : undefined
      }
    >
      {message}
    </Banner>
  );
}
