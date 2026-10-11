import { type ClassMergeConfig, createClassMerger } from "./class-merge";

export type { ClassMergeConfig, ClassMergeTheme } from "./class-merge";

export type ClassValue =
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined
  | ClassDictionary
  | ClassArray;
export type ClassDictionary = Record<string, unknown>;
export type ClassArray = ClassValue[];

/** Join class values (strings, numbers, arrays, objects) skipping falsy ones; clsx-compatible. */
function clsx(...inputs: ClassValue[]): string {
  let out = "";
  for (const input of inputs) {
    const part = toClass(input);
    if (part) out += (out ? " " : "") + part;
  }
  return out;
}

function toClass(value: ClassValue): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (typeof value !== "object") return "";
  if (Array.isArray(value)) return clsx(...value);
  let out = "";
  for (const key of Object.keys(value)) {
    if (value[key]) out += (out ? " " : "") + key;
  }
  return out;
}

/** A class-name joiner that resolves conflicting Tailwind utilities (last one wins). */
export interface Cn {
  (...inputs: ClassValue[]): string;
  /** The configuration this instance was created with; read by {@link extendCn}. */
  readonly config: ClassMergeConfig;
}

/**
 * Create a `cn` that also knows your own theme tokens, so `text-hero` and `text-lg` conflict
 * instead of both being kept. Create it once at module scope: the lookup table is built on first
 * use and results are cached per instance. The default {@link cn} is never affected.
 *
 * @example
 * const cn = createCn({
 *   theme: { text: ["hero"], spacing: ["gutter"], radius: ["blob"], shadow: ["glow"] },
 * });
 * cn("text-lg text-hero"); // "text-hero"
 * cn("p-gutter p-2"); // "p-2"
 *
 * `theme.color` is accepted for symmetry, but any unknown value already reads as a color.
 * Use `classGroups` (`[groupId, prefix, values]`) and `conflicts` for utilities beyond the theme.
 */
export function createCn(config: ClassMergeConfig = {}): Cn {
  const merge = createClassMerger(config);
  const instance = (...inputs: ClassValue[]): string => merge(clsx(...inputs));
  return Object.assign(instance, { config });
}

/**
 * Build a new `cn` from an existing one plus more configuration; theme tokens, class groups and
 * conflicts are concatenated, the base instance is left untouched.
 */
export function extendCn(base: Cn, more: ClassMergeConfig): Cn {
  const theme: Record<string, readonly string[]> = { ...base.config.theme };
  for (const [key, tokens] of Object.entries(more.theme ?? {})) {
    theme[key] = [...(theme[key] ?? []), ...(tokens ?? [])];
  }
  const conflicts: Record<string, readonly string[]> = { ...base.config.conflicts };
  for (const [group, others] of Object.entries(more.conflicts ?? {})) {
    conflicts[group] = [...(conflicts[group] ?? []), ...others];
  }
  return createCn({
    theme,
    classGroups: [...(base.config.classGroups ?? []), ...(more.classGroups ?? [])],
    conflicts,
  });
}

/** Merge class names, resolving conflicting Tailwind utilities (last one wins). */
export const cn: Cn = /* @__PURE__ */ createCn();
