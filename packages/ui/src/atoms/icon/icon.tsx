import type { IconComponent } from "../../icons/index.js";
import { type IconName, icons } from "./icon-map.js";

export interface IconProps {
  /** Registry name; ignored when `icon` is provided. */
  name?: IconName;
  /** Any icon component (see `@jcsoftdev/ui/icons`). */
  icon?: IconComponent;
  /** Accessible label. Without it the icon is decorative (aria-hidden). */
  label?: string;
  className?: string;
}

export function Icon({ name, icon, label, className }: IconProps) {
  const Component = icon ?? (name ? icons[name] : undefined);
  if (!Component) return null;

  if (label) {
    return <Component className={className} role="img" aria-label={label} strokeWidth={1.8} />;
  }

  return <Component className={className} aria-hidden="true" strokeWidth={1.8} />;
}
