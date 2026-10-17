/** A step gate: a plain flag, or a check that may be asynchronous. */
export type WizardGate = boolean | (() => boolean | Promise<boolean>);

export interface GateResult {
  /** True when every gate allowed the move. */
  ok: boolean;
  /** True when a gate threw or rejected (the move is blocked either way). */
  failed: boolean;
}

/** Runs the gates in order and stops at the first one that blocks; a throwing gate blocks. */
export async function evaluateGates(
  gates: ReadonlyArray<WizardGate | undefined>,
): Promise<GateResult> {
  for (const gate of gates) {
    if (gate === undefined) continue;
    try {
      const allowed = typeof gate === "function" ? await gate() : gate;
      if (allowed === false) return { ok: false, failed: false };
    } catch {
      return { ok: false, failed: true };
    }
  }
  return { ok: true, failed: false };
}

export function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return Math.min(Math.max(Math.trunc(index) || 0, 0), length - 1);
}

/** Fills the `{current}`, `{total}` and `{label}` placeholders of the `stepOf` UI string. */
export function formatStepOf(
  template: string,
  values: { current: number; total: number; label: string },
): string {
  return template
    .replace("{current}", String(values.current))
    .replace("{total}", String(values.total))
    .replace("{label}", values.label);
}

/** Enter inside a single-line text-like input advances the wizard, like submitting a form. */
export function isAdvanceKey(event: {
  key: string;
  defaultPrevented: boolean;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  nativeEvent?: { isComposing?: boolean };
  target: EventTarget | { tagName?: string; type?: string };
}): boolean {
  if (event.key !== "Enter" || event.defaultPrevented) return false;
  if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return false;
  if (event.nativeEvent?.isComposing) return false;
  const target = event.target as { tagName?: string; type?: string };
  if (target.tagName !== "INPUT") return false;
  const type = target.type ?? "text";
  return !["checkbox", "radio", "button", "submit", "reset", "file", "image"].includes(type);
}
