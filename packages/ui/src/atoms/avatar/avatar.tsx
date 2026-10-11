"use client";

import { type ComponentPropsWithRef, useEffect, useState } from "react";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";

type ImageStatus = "idle" | "loading" | "loaded" | "error";

/** Preloads `src` off-DOM; effects only, so server rendering never touches `window`. */
function useImageStatus(src: string | undefined): ImageStatus {
  const [status, setStatus] = useState<ImageStatus>("idle");

  useEffect(() => {
    if (!src) {
      setStatus("error");
      return;
    }
    const image = new window.Image();
    const settle = () =>
      setStatus(image.complete ? (image.naturalWidth > 0 ? "loaded" : "error") : "loading");
    const onError = () => setStatus("error");
    image.addEventListener("load", settle);
    image.addEventListener("error", onError);
    image.src = src;
    settle();
    return () => {
      image.removeEventListener("load", settle);
      image.removeEventListener("error", onError);
      setStatus("idle");
    };
  }, [src]);

  return status;
}

/** Holds the fallback back for `delayMs` so a fast image never flashes initials. */
function useDelayElapsed(delayMs: number | undefined): boolean {
  const [elapsed, setElapsed] = useState(delayMs === undefined);

  useEffect(() => {
    if (delayMs === undefined) {
      setElapsed(true);
      return;
    }
    setElapsed(false);
    const timer = window.setTimeout(() => setElapsed(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs]);

  return elapsed;
}

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
  md: "size-6.5 text-fs-100",
  lg: "size-8 text-fs-110",
};

export type AvatarPart = "root" | "image" | "fallback";

export interface AvatarProps extends Omit<ComponentPropsWithRef<"span">, "children"> {
  /** Full name: used for the initials fallback and as the accessible name. */
  name: string;
  src?: string;
  size?: AvatarSize;
  /** Fills the avatar with the accent color (e.g. the current user). */
  highlighted?: boolean;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root. */
  classNames?: ClassNames<AvatarPart>;
}

export function Avatar({
  name,
  src,
  size = "md",
  highlighted,
  className,
  classNames,
  ...props
}: AvatarProps) {
  const status = useImageStatus(src);
  const delayElapsed = useDelayElapsed(src ? 400 : undefined);

  return (
    <span
      role="img"
      aria-label={name}
      {...props}
      className={cn(
        "inline-grid shrink-0 place-items-center overflow-hidden rounded-avatar font-bold tracking-[.02em]",
        highlighted ? "bg-accent text-on-accent" : "bg-sunken text-ink-2",
        sizeClasses[size],
        className,
        classNames?.root,
      )}
    >
      {src && status === "loaded" ? <img src={src} alt="" className={classNames?.image} /> : null}
      {delayElapsed && status !== "loaded" ? (
        <span aria-hidden="true" className={classNames?.fallback}>
          {initials(name)}
        </span>
      ) : null}
    </span>
  );
}
