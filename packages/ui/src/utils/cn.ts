import { mergeClasses } from "./class-merge";

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

/** Merge class names, resolving conflicting Tailwind utilities (last one wins). */
export function cn(...inputs: ClassValue[]): string {
  return mergeClasses(clsx(...inputs));
}
