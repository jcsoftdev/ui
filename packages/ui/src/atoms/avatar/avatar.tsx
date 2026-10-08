"use client";

import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "../../utils/cn.js";

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    return (words[0]?.slice(0, 2) ?? "").toUpperCase();
  }
  const first = words[0]?.at(0) ?? "";
  const last = words.at(-1)?.at(0) ?? "";
  return `${first}${last}`.toUpperCase();
}

export type AvatarSize = "md" | "lg";

const sizeClasses: Record<AvatarSize, string> = {
  md: "size-[26px] text-[10px]",
  lg: "size-8 text-[11px]",
};

export interface AvatarProps {
  /** Full name: used for the initials fallback and as the accessible name. */
  name: string;
  src?: string;
  size?: AvatarSize;
  /** Fills the avatar with the accent color (e.g. the current user). */
  highlighted?: boolean;
  className?: string;
}

export function Avatar({ name, src, size = "md", highlighted, className }: AvatarProps) {
  return (
    <AvatarPrimitive.Root
      role="img"
      aria-label={name}
      className={cn(
        "inline-grid shrink-0 place-items-center overflow-hidden rounded-pill font-bold tracking-[.02em]",
        highlighted ? "bg-accent text-on-accent" : "bg-sunken text-ink-2",
        sizeClasses[size],
        className,
      )}
    >
      {src ? <AvatarPrimitive.Image src={src} alt="" /> : null}
      <AvatarPrimitive.Fallback aria-hidden="true" delayMs={src ? 400 : undefined}>
        {initials(name)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
