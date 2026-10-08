import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "../../utils/cn.js";

export type BannerTone = "info" | "success" | "warning" | "danger";

const toneClasses: Record<BannerTone, string> = {
  info: "bg-accent-soft",
  success: "bg-success-soft",
  warning: "bg-warning-soft",
  danger: "bg-danger-soft",
};

const toneIconClasses: Record<BannerTone, string> = {
  info: "text-accent-ink",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

/**
 * `info`/`success` are non-urgent notices (`role=status`, polite live region).
 * `warning`/`danger` need attention (`role=alert`, assertive live region).
 */
const toneRole: Record<BannerTone, "status" | "alert"> = {
  info: "status",
  success: "status",
  warning: "alert",
  danger: "alert",
};

export interface BannerProps extends Omit<ComponentPropsWithoutRef<"div">, "role"> {
  tone?: BannerTone;
  /** Decorative icon on the left; marked `aria-hidden`. */
  icon?: ReactNode;
  /** Actions on the right, e.g. a retry button. */
  action?: ReactNode;
}

export function Banner({
  tone = "info",
  icon,
  action,
  className,
  children,
  ...props
}: BannerProps) {
  return (
    <div
      role={toneRole[tone]}
      className={cn(
        "flex items-start gap-3 rounded-banner px-3.5 py-3 text-[13px] text-ink",
        toneClasses[tone],
        className,
      )}
      {...props}
    >
      {icon ? (
        <span aria-hidden="true" className={cn("mt-0.5 shrink-0", toneIconClasses[tone])}>
          {icon}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">{children}</div>
      {action ? <div className="ml-auto flex shrink-0 items-center gap-1.5">{action}</div> : null}
    </div>
  );
}
