import type { ComponentPropsWithoutRef, ReactNode } from "react";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { customToneStyle, isCustomTone } from "../../utils/tone.js";

export type SealBuiltinTone =
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "neutral"
  | "institutional";

/** A built-in tone, or the name of a tone declared in `tonePalettes`. */
export type SealTone = SealBuiltinTone | (string & {});

const toneClasses: Record<SealBuiltinTone, { frame: string; title: string }> = {
  accent: { frame: "border-accent-ink", title: "text-accent-ink" },
  success: { frame: "border-success", title: "text-success" },
  warning: { frame: "border-warning", title: "text-warning" },
  danger: { frame: "border-danger", title: "text-danger" },
  neutral: { frame: "border-line-strong", title: "text-ink-2" },
  institutional: { frame: "border-ink", title: "text-ink" },
};

const builtinTones = new Set<string>(Object.keys(toneClasses));

export type SealPart = "root" | "icon" | "title" | "body";

export interface SealProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  /** Heading of the stamp, set in small caps-style capitals. */
  title?: ReactNode;
  /** Decorative glyph before the title (`aria-hidden`). */
  icon?: ReactNode;
  /**
   * Frame and title colour. `institutional` is the strong neutral (ink frame) for official
   * seals that must not read as a status; any other name resolves through `tonePalettes`.
   */
  tone?: SealTone;
  /**
   * Accessible name. Set it and the seal becomes a labelled `group`; without it the seal is
   * plain text content the reader encounters in order.
   */
  label?: string;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root. */
  classNames?: ClassNames<SealPart>;
}

/**
 * An official-looking stamp: a heavy tone-colored frame with a title and the lines that vouch
 * for a document (issuer, code, date). Children are the lines, usually `<p>`. Purely
 * typographic, so it prints and scales with the text.
 */
export function Seal({
  title,
  icon,
  tone = "accent",
  label,
  className,
  classNames,
  children,
  ...props
}: SealProps) {
  const custom = isCustomTone(tone, builtinTones);
  const classes = custom
    ? { frame: "border-(--tone-c)", title: "text-(--tone-c-ink)" }
    : (toneClasses[tone as SealBuiltinTone] ?? toneClasses.accent);
  return (
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: the role is `group` exactly when `label` is set
    <div
      role={label ? "group" : undefined}
      aria-label={label}
      data-tone={tone}
      {...props}
      style={customToneStyle(tone, builtinTones, props.style)}
      className={cn(
        "flex min-w-0 flex-col gap-0.5 rounded-card border-2 p-4 text-ink text-meta",
        classes.frame,
        classNames?.root,
        className,
      )}
    >
      {title !== undefined || icon !== undefined ? (
        <div
          className={cn(
            "flex items-center gap-1.5 font-semibold uppercase tracking-wide",
            classes.title,
            classNames?.title,
          )}
        >
          {icon !== undefined ? (
            <span
              aria-hidden="true"
              className={cn("inline-flex shrink-0 [&_svg]:size-4", classNames?.icon)}
            >
              {icon}
            </span>
          ) : null}
          {title}
        </div>
      ) : null}
      <div className={cn("min-w-0 [&_p]:m-0 [overflow-wrap:anywhere]", classNames?.body)}>
        {children}
      </div>
    </div>
  );
}
