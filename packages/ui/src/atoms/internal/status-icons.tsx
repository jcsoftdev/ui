import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

export type StatusTone = "info" | "success" | "warning" | "danger";

const icons = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleAlert,
} as const;

/** Decorative glyph that pairs a status tone with a shape, so status never relies on color alone. */
export function statusIcon(tone: StatusTone, className = "size-4"): ReactNode {
  const Icon = icons[tone];
  return <Icon aria-hidden="true" className={className} />;
}
