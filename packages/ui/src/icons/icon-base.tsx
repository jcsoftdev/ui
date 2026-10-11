import type { ComponentProps, ReactNode } from "react";

export interface IconProps extends ComponentProps<"svg"> {
  /** Width and height in px. Defaults to 24. */
  size?: number | string;
  /** Stroke width in the 24px grid. Defaults to 2. */
  strokeWidth?: number | string;
  /** Keep the rendered stroke width constant when `size` changes. */
  absoluteStrokeWidth?: boolean;
}

/** Any icon of the set, or a custom component with the same props. */
export type IconComponent = (props: IconProps) => ReactNode;

/** @deprecated Renamed to `IconComponent`. */
export type LucideIcon = IconComponent;

function hasAccessibleName(props: Record<string, unknown>) {
  if (props.role !== undefined || props.title !== undefined) return true;
  return Object.keys(props).some((key) => key.startsWith("aria-") && key !== "aria-hidden");
}

export function IconBase({
  size = 24,
  strokeWidth = 2,
  absoluteStrokeWidth = false,
  color = "currentColor",
  children,
  ...props
}: IconProps) {
  const width = Number(strokeWidth);
  const scaled = absoluteStrokeWidth ? (width * 24) / Number(size) : width;
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: decorative unless the caller passes aria-*, role or title
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth={scaled}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={hasAccessibleName(props) ? undefined : true}
      {...props}
    >
      {children}
    </svg>
  );
}
