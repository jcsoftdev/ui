import type { IconComponent, IconProps as SvgIconProps } from "../../icons/index.js";
import { type IconName, icons } from "./icon-map.js";

export interface IconProps extends Omit<SvgIconProps, "children"> {
  /** Registry name; ignored when `icon` is provided. */
  name?: IconName;
  /** Any icon component (see `@jcsoftdev/ui/icons`). */
  icon?: IconComponent;
  /** Accessible label. Without it the icon is decorative (aria-hidden). */
  label?: string;
}

export function Icon({ name, icon, label, ...props }: IconProps) {
  const Component = icon ?? (name ? icons[name] : undefined);
  if (!Component) return null;

  if (label) {
    return <Component strokeWidth={1.8} {...props} role="img" aria-label={label} />;
  }

  return <Component strokeWidth={1.8} {...props} aria-hidden="true" />;
}
