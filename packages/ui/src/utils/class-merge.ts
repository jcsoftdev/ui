import { CONFLICTS, type Def, GROUPS, ORDER_SENSITIVE } from "./class-groups";
import type { Validator } from "./class-validators";

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

function add(into: Node, group: string, defs: Def[]): void {
  for (const def of defs) {
    if (typeof def === "string") {
      // The empty string means the prefix itself (`rounded`, `border`).
      (def === "" ? into : child(into, def)).group = group;
    } else if (typeof def === "function") {
      into.validators.push([group, def]);
    } else {
      for (const key of Object.keys(def)) add(child(into, key), group, def[key]);
    }
  }
}

let root: Node | undefined;

function table(): Node {
  if (root) return root;
  root = node();
  for (const [group, prefix, values] of GROUPS) {
    add(prefix ? child(root, prefix) : root, group, values);
  }
  return root;
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

function groupOf(base: string): string | undefined {
  if (base.startsWith("[") && base.endsWith("]")) {
    // Arbitrary property `[mask-type:luminance]` conflicts with itself only.
    const inner = base.slice(1, -1);
    const colon = inner.indexOf(":");
    return colon > 0 ? `arbitrary..${inner.slice(0, colon)}` : undefined;
  }
  const parts = base.split("-");
  // `-inset-1`: the empty first part marks a negative value.
  return lookup(parts, parts[0] === "" && parts.length > 1 ? 1 : 0, table());
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
const cache = new Map<string, string>();

/** Resolve conflicts in a space-separated class list; the last conflicting class wins. */
export function mergeClasses(list: string): string {
  const hit = cache.get(list);
  if (hit !== undefined) return hit;
  const claimed = new Set<string>();
  const kept: string[] = [];
  const classes = list.trim().split(WHITESPACE);
  for (let i = classes.length - 1; i >= 0; i--) {
    const original = classes[i];
    const { variants, important, base, slash } = parse(original);
    let group: string | undefined;
    let hasSlash = slash !== undefined;
    if (slash !== undefined) {
      group = groupOf(base.slice(0, slash));
      // `@container/name` is the only group where the `/` belongs to the class itself.
      if (group === "container-type") {
        const whole = groupOf(base);
        if (whole && whole !== group) {
          group = whole;
          hasSlash = false;
        }
      }
    } else {
      group = groupOf(base);
    }
    if (!group && hasSlash) {
      group = groupOf(base);
      hasSlash = false;
    }
    if (!group) {
      kept.push(original);
      continue;
    }
    const prefix = variantKey(variants) + (important ? "!" : "");
    if (claimed.has(prefix + group)) continue;
    claimed.add(prefix + group);
    for (const other of CONFLICTS[group] ?? []) claimed.add(prefix + other);
    kept.push(original);
  }
  const result = kept.reverse().join(" ");
  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(list, result);
  return result;
}
