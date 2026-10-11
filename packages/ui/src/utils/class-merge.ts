import {
  CONFLICTS,
  type Def,
  GROUPS,
  type GroupEntry,
  ORDER_SENSITIVE,
  RADII,
  SHADOWS,
  SPACINGS,
  TEXT_SIZES,
  type ThemeKey,
  type ThemeRef,
} from "./class-groups.js";
import type { Validator } from "./class-validators.js";

/**
 * Tailwind class conflict resolver (Tailwind v4 conventions). Derived from the MIT-licensed
 * twMerge by Dany Castillo (github.com/dcastil), copyright (c) 2021 Dany Castillo: classes are
 * scanned last to first and a class is dropped when a later one already claimed its group,
 * with variants and `!` part of the identity. Unrecognized classes are kept untouched.
 */

interface Node {
  next: Map<string, Node>;
  validators: [group: string, test: Validator][];
  group?: string;
}

const node = (): Node => ({ next: new Map(), validators: [] });

function child(parent: Node, path: string): Node {
  let cur = parent;
  for (const part of path.split("-")) {
    let next = cur.next.get(part);
    if (!next) {
      next = node();
      cur.next.set(part, next);
    }
    cur = next;
  }
  return cur;
}

/** Extra theme tokens, without the Tailwind prefix: `text: ["hero"]` teaches `text-hero`. */
export type ClassMergeTheme = Partial<Record<ThemeKey, readonly string[]>>;

/** Options for {@link createClassMerger}. */
export interface ClassMergeConfig {
  /** Extra tokens per theme namespace, added to the kit's own. */
  theme?: ClassMergeTheme;
  /** Extra class groups, `[groupId, prefix, values]`. Reusing a kit group id joins that group. */
  classGroups?: readonly GroupEntry[];
  /** Extra conflicts: `groupId -> groups it overrides`. Merged with the kit's map. */
  conflicts?: Readonly<Record<string, readonly string[]>>;
}

const KIT_THEME: Record<ThemeKey, readonly string[]> = {
  text: TEXT_SIZES,
  spacing: SPACINGS,
  radius: RADII,
  shadow: SHADOWS,
  color: [],
};

const isThemeRef = (def: Def): def is ThemeRef => typeof (def as ThemeRef).$theme === "string";

function add(into: Node, group: string, defs: readonly Def[], tokens: (key: ThemeKey) => string[]) {
  for (const def of defs) {
    if (typeof def === "string") {
      // The empty string means the prefix itself (`rounded`, `border`).
      (def === "" ? into : child(into, def)).group = group;
    } else if (typeof def === "function") {
      into.validators.push([group, def]);
    } else if (isThemeRef(def)) {
      for (const token of tokens(def.$theme)) child(into, token).group = group;
    } else {
      for (const key of Object.keys(def)) add(child(into, key), group, def[key], tokens);
    }
  }
}

function lookup(parts: string[], at: number, cur: Node): string | undefined {
  if (at === parts.length) return cur.group;
  const next = cur.next.get(parts[at]);
  if (next) {
    const hit = lookup(parts, at + 1, next);
    if (hit) return hit;
  }
  if (cur.validators.length === 0) return undefined;
  const rest = parts.slice(at).join("-");
  for (const [group, test] of cur.validators) if (test(rest)) return group;
  return undefined;
}

function groupIn(root: Node, base: string): string | undefined {
  if (base.startsWith("[") && base.endsWith("]")) {
    // Arbitrary property `[mask-type:luminance]` conflicts with itself only.
    const inner = base.slice(1, -1);
    const colon = inner.indexOf(":");
    return colon > 0 ? `arbitrary..${inner.slice(0, colon)}` : undefined;
  }
  const parts = base.split("-");
  // `-inset-1`: the empty first part marks a negative value.
  return lookup(parts, parts[0] === "" && parts.length > 1 ? 1 : 0, root);
}

interface Parsed {
  variants: string[];
  important: boolean;
  base: string;
  /** Index of a `/` modifier inside `base` (`text-lg/7`, `bg-red/50`). */
  slash?: number;
}

/** Split `a:b:[&_p]:!text-lg/7` at top level only, ignoring `:` and `/` inside `[]` and `()`. */
function parse(cls: string): Parsed {
  const variants: string[] = [];
  let depth = 0;
  let start = 0;
  let slash: number | undefined;
  for (let i = 0; i < cls.length; i++) {
    const c = cls[i];
    if (depth === 0) {
      if (c === ":") {
        variants.push(cls.slice(start, i));
        start = i + 1;
        continue;
      }
      if (c === "/") {
        slash = i;
        continue;
      }
    }
    if (c === "[" || c === "(") depth++;
    else if (c === "]" || c === ")") depth--;
  }
  let base = variants.length === 0 ? cls : cls.slice(start);
  let important = false;
  // Trailing `!` is v4; a leading `!` is the v3 spelling that v4 still accepts.
  if (base.endsWith("!")) {
    base = base.slice(0, -1);
    important = true;
  } else if (base.startsWith("!")) {
    base = base.slice(1);
    important = true;
  }
  return {
    variants,
    important,
    base,
    slash: slash !== undefined && slash > start ? slash - start : undefined,
  };
}

/** Variants are order-independent (`hover:focus:` equals `focus:hover:`) except pseudo-element ones. */
function variantKey(variants: string[]): string {
  if (variants.length < 2) return variants[0] ?? "";
  const out: string[] = [];
  let run: string[] = [];
  for (const v of variants) {
    if (v[0] === "[" || ORDER_SENSITIVE.has(v)) {
      out.push(...run.sort(), v);
      run = [];
    } else {
      run.push(v);
    }
  }
  out.push(...run.sort());
  return out.join(":");
}

const WHITESPACE = /\s+/;
const CACHE_LIMIT = 500;

/**
 * Build a class resolver. The group trie is built on first use and results are cached per
 * instance, so create one at module scope and reuse it; instances never share state.
 */
export function createClassMerger(config: ClassMergeConfig = {}): (list: string) => string {
  const extra = config.theme ?? {};
  const conflicts = config.conflicts;
  const cache = new Map<string, string>();
  let root: Node | undefined;

  const table = (): Node => {
    if (root) return root;
    const tokens = (key: ThemeKey): string[] => [...KIT_THEME[key], ...(extra[key] ?? [])];
    root = node();
    for (const [group, prefix, values] of GROUPS) {
      add(prefix ? child(root, prefix) : root, group, values, tokens);
    }
    for (const [group, prefix, values] of config.classGroups ?? []) {
      add(prefix ? child(root, prefix) : root, group, values, tokens);
    }
    return root;
  };

  const conflictsOf = (group: string): readonly string[] | undefined => {
    const own = CONFLICTS[group];
    const more = conflicts?.[group];
    return more ? (own ? [...own, ...more] : more) : own;
  };

  return (list) => {
    const hit = cache.get(list);
    if (hit !== undefined) return hit;
    const trie = table();
    const claimed = new Set<string>();
    const kept: string[] = [];
    const classes = list.trim().split(WHITESPACE);
    for (let i = classes.length - 1; i >= 0; i--) {
      const original = classes[i];
      const { variants, important, base, slash } = parse(original);
      let group: string | undefined;
      let hasSlash = slash !== undefined;
      if (slash !== undefined) {
        group = groupIn(trie, base.slice(0, slash));
        // `@container/name` is the only group where the `/` belongs to the class itself.
        if (group === "container-type") {
          const whole = groupIn(trie, base);
          if (whole && whole !== group) {
            group = whole;
            hasSlash = false;
          }
        }
      } else {
        group = groupIn(trie, base);
      }
      if (!group && hasSlash) {
        group = groupIn(trie, base);
        hasSlash = false;
      }
      if (!group) {
        kept.push(original);
        continue;
      }
      const prefix = variantKey(variants) + (important ? "!" : "");
      if (claimed.has(prefix + group)) continue;
      claimed.add(prefix + group);
      for (const other of conflictsOf(group) ?? []) claimed.add(prefix + other);
      kept.push(original);
    }
    const result = kept.reverse().join(" ");
    if (cache.size >= CACHE_LIMIT) cache.clear();
    cache.set(list, result);
    return result;
  };
}
