import { cn } from "../../utils/cn.js";

export type StatusDotTone = "danger" | "warning" | "success" | "accent" | "neutral";

const toneClasses: Record<StatusDotTone, string> = {
  danger: "bg-danger",
  warning: "bg-warning",
  success: "bg-success",
  accent: "bg-accent",
  neutral: "bg-ink-3",
};

export type StatusDotShape = "dot" | "square";

const shapeClasses: Record<StatusDotShape, string> = {
  dot: "size-1.5 rounded-pill",
  square: "size-[9px] rounded-xs",
};

export interface StatusDotProps {
  tone: StatusDotTone;
  /** Text describing the status: color is never the only signal. */
  label: string;
  showLabel?: boolean;
  shape?: StatusDotShape;
  /** Hollow variant: transparent fill with an accent inner ring. */
  hollow?: boolean;
  className?: string;
}

export function StatusDot({
  tone,
  label,
  showLabel,
  shape = "dot",
  hollow,
  className,
}: StatusDotProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        aria-hidden="true"
        className={cn(
          "shrink-0",
          shapeClasses[shape],
          hollow ? "bg-transparent shadow-[inset_0_0_0_2px_var(--accent)]" : toneClasses[tone],
        )}
      />
      <span className={showLabel ? undefined : "sr-only"}>{label}</span>
    </span>
  );
}
