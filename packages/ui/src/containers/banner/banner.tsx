import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { statusIcon } from "../../atoms/internal/status-icons.js";
import { cn } from "../../utils/cn.js";

export type BannerTone = "info" | "success" | "warning" | "danger";

const toneClasses: Record<BannerTone, string> = {
  info: "bg-info-soft",
  success: "bg-success-soft",
  warning: "bg-warning-soft",
  danger: "bg-danger-soft",
};

const toneIconClasses: Record<BannerTone, string> = {
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

/**
 * Only `danger` interrupts (`role=alert`, assertive live region); every other tone is a polite
 * `role=status` notice.
 */
const toneRole: Record<BannerTone, "status" | "alert"> = {
  info: "status",
  success: "status",
  warning: "status",
  danger: "alert",
};

export interface BannerProps extends Omit<ComponentPropsWithoutRef<"div">, "role" | "title"> {
  tone?: BannerTone;
  /** Bold first line above the content. */
  title?: ReactNode;
  /** Decorative icon on the left; marked `aria-hidden`. Defaults to a glyph for the tone; `null` hides it. */
  icon?: ReactNode;
  /** Actions on the right, e.g. a retry button. */
  action?: ReactNode;
}

export function Banner({
  tone = "info",
  title,
  icon,
  action,
  className,
  children,
  ...props
}: BannerProps) {
  const resolvedIcon = icon === undefined ? statusIcon(tone) : icon;
  return (
    <div
      role={toneRole[tone]}
      className={cn(
        "flex flex-wrap items-start gap-x-3 gap-y-2 rounded-banner px-3.5 py-3 text-[13px] text-ink",
        toneClasses[tone],
        className,
      )}
      {...props}
    >
      {resolvedIcon ? (
        <span aria-hidden="true" className={cn("mt-0.5 shrink-0", toneIconClasses[tone])}>
          {resolvedIcon}
        </span>
      ) : null}
      <div className="min-w-0 flex-[1_1_14rem] break-words">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children}
      </div>
      {action ? (
        <div className="ml-auto flex shrink-0 flex-wrap items-center gap-1.5">{action}</div>
      ) : null}
    </div>
  );
}
