"use client";

import { type ComponentPropsWithRef, useEffect, useState } from "react";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { customToneStyle, isCustomTone } from "../../utils/tone.js";
import { StatusDot, type StatusDotTone } from "../status-dot/status-dot.js";

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

export type AvatarBuiltinTone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

/** A built-in tone, or the name of a tone declared in `tonePalettes`. */
export type AvatarTone = AvatarBuiltinTone | (string & {});

const toneClasses: Record<AvatarBuiltinTone, string> = {
  neutral: "bg-sunken text-ink-2",
  accent: "bg-accent-soft text-accent-ink",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
};

const builtinTones = new Set<string>(Object.keys(toneClasses));

export type AvatarPart = "root" | "image" | "fallback" | "wrapper" | "status";

export interface AvatarProps extends Omit<ComponentPropsWithRef<"span">, "children"> {
  /** Full name: used for the initials fallback and as the accessible name. */
  name: string;
  src?: string;
  size?: AvatarSize;
  /** Fills the avatar with the accent color (e.g. the current user). Wins over `tone`. */
  highlighted?: boolean;
  /** Soft background and ink colour of the initials. */
  tone?: AvatarTone;
  /** Small status dot at the bottom-right corner. */
  status?: StatusDotTone;
  /** Accessible text for the status dot; defaults to the status name. */
  statusLabel?: string;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<AvatarPart>;
}

export function Avatar({
  name,
  src,
  size = "md",
  highlighted,
  tone = "neutral",
  status: statusTone,
  statusLabel,
  className,
  classNames,
  style,
  ...props
}: AvatarProps) {
  const status = useImageStatus(src);
  const delayElapsed = useDelayElapsed(src ? 400 : undefined);

  const toneClass = isCustomTone(tone, builtinTones)
    ? "bg-(--tone-c-soft) text-(--tone-c-ink)"
    : (toneClasses[tone as AvatarBuiltinTone] ?? toneClasses.neutral);

  const avatar = (
    <span
      role="img"
      aria-label={name}
      {...props}
      style={customToneStyle(tone, builtinTones, style)}
      className={cn(
        "inline-grid shrink-0 place-items-center overflow-hidden rounded-avatar font-bold tracking-[.02em]",
        highlighted ? "bg-accent text-on-accent" : toneClass,
        sizeClasses[size],
        classNames?.root,
        className,
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

  if (statusTone === undefined) return avatar;

  return (
    <span className={cn("relative inline-flex shrink-0", classNames?.wrapper)}>
      {avatar}
      <span
        className={cn(
          "absolute right-0 bottom-0 inline-flex rounded-pill bg-surface p-0.5",
          classNames?.status,
        )}
      >
        <StatusDot
          tone={statusTone}
          label={statusLabel ?? statusTone}
          classNames={{ dot: "size-2" }}
        />
      </span>
    </span>
  );
}
