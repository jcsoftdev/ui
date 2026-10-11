export type ConfirmResult = { ok: true } | { ok: false; error: string };

export type ConfirmOutcome = { status: "done" } | { status: "failed"; message: string };

/** Runs the confirmed action and folds a returned failure or a thrown error into one outcome. */
export async function runConfirm(
  onConfirm: () => Promise<ConfirmResult> | Promise<void>,
  fallbackMessage: string,
): Promise<ConfirmOutcome> {
  try {
    const result = (await onConfirm()) as ConfirmResult | undefined;
    if (result !== undefined && !result.ok) return { status: "failed", message: result.error };
    return { status: "done" };
  } catch {
    return { status: "failed", message: fallbackMessage };
  }
}
