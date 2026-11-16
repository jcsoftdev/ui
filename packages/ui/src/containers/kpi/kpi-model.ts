export type KpiVariant = "default" | "danger";

export type KpiBuiltinTone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

export type KpiTone = KpiBuiltinTone | (string & {});

export const valueToneClasses: Record<KpiBuiltinTone, string> = {
  neutral: "text-ink",
  accent: "text-accent-ink",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-info",
};

export const dotToneClasses: Record<KpiBuiltinTone, string> = {
  neutral: "bg-ink-3",
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
};

export const builtinTones = new Set<string>(Object.keys(valueToneClasses));

export type KpiPart =
  | "root"
  | "header"
  | "label"
  | "dot"
  | "icon"
  | "trailing"
  | "value"
  | "suffix"
  | "trend"
  | "description";
