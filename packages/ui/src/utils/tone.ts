import type { CSSProperties } from "react";

const TONE_NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/**
 * Names of tones a component styles with its own classes; anything else is looked up as
 * `--tone-<name>`, `--tone-<name>-soft` and `--tone-<name>-ink`, which `tonePalettes` in a theme emits.
 */
export function isCustomTone(
  tone: string | undefined,
  builtin: ReadonlySet<string>,
): tone is string {
  return tone !== undefined && !builtin.has(tone) && TONE_NAME.test(tone);
}

/** Maps a custom tone to the local `--tone-c*` variables the component classes read. */
export function customToneStyle(
  tone: string | undefined,
  builtin: ReadonlySet<string>,
  style?: CSSProperties,
): CSSProperties | undefined {
  if (!isCustomTone(tone, builtin)) return style;
  return {
    "--tone-c": `var(--tone-${tone})`,
    "--tone-c-soft": `var(--tone-${tone}-soft)`,
    "--tone-c-ink": `var(--tone-${tone}-ink)`,
    ...style,
  } as CSSProperties;
}
