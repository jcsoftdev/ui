"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button, type ButtonVariant } from "../../atoms/button/button.js";
import { useUiStrings } from "../../i18n/index.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { Banner } from "../banner/banner.js";
import { type ConfirmResult, runConfirm } from "./model.js";

export type ConfirmActionPart =
  | "root"
  | "trigger"
  | "consequence"
  | "error"
  | "actions"
  | "confirm"
  | "cancel";

export interface ConfirmActionProps {
  /** Trigger label, a verb in the user's words ("Cancel order"). */
  label: string;
  /** What will happen, said plainly, shown before the user commits. */
  consequence: string;
  /** Label of the destructive button. Defaults to the localized "Confirm". */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Runs on confirm. Return `{ ok: false, error }` or throw to keep the step open with a message. */
  onConfirm: () => Promise<ConfirmResult> | Promise<void>;
  triggerVariant?: ButtonVariant;
  className?: string;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root. */
  classNames?: ClassNames<ConfirmActionPart>;
}

/** Inline two-step confirmation for a destructive action; no modal, no lost context. */
export function ConfirmAction({
  label,
  consequence,
  confirmLabel,
  cancelLabel,
  onConfirm,
  triggerVariant = "secondary",
  className,
  classNames,
}: ConfirmActionProps) {
  const strings = useUiStrings();
  const consequenceId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (wasConfirming.current && !confirming) triggerRef.current?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);

  async function confirm(): Promise<void> {
    setBusy(true);
    setFailure(null);
    const outcome = await runConfirm(onConfirm, strings.actionFailed);
    setBusy(false);
    if (outcome.status === "failed") setFailure(outcome.message);
    else setConfirming(false);
  }

  if (!confirming) {
    return (
      <div className={cn("flex flex-col gap-2", className, classNames?.root)}>
        {failure === null ? null : (
          <Banner tone="danger" className={classNames?.error}>
            {failure}
          </Banner>
        )}
        <Button
          ref={triggerRef}
          variant={triggerVariant}
          className={classNames?.trigger}
          onClick={() => setConfirming(true)}
        >
          {label}
        </Button>
      </div>
    );
  }

  return (
    <fieldset
      aria-describedby={consequenceId}
      className={cn("m-0 flex min-w-0 flex-col gap-3 border-0 p-0", className, classNames?.root)}
    >
      <legend className="sr-only">{label}</legend>
      <p id={consequenceId} className={cn("text-body text-ink", classNames?.consequence)}>
        {consequence}
      </p>
      {failure === null ? null : (
        <Banner tone="danger" className={classNames?.error}>
          {failure}
        </Banner>
      )}
      <div className={cn("flex flex-wrap gap-2", classNames?.actions)}>
        <Button
          variant="danger"
          className={classNames?.confirm}
          loading={busy}
          loadingLabel={strings.processing}
          onClick={() => void confirm()}
        >
          {confirmLabel ?? strings.confirm}
        </Button>
        <Button
          variant="secondary"
          className={classNames?.cancel}
          disabled={busy}
          autoFocus
          onClick={() => setConfirming(false)}
        >
          {cancelLabel ?? strings.cancel}
        </Button>
      </div>
    </fieldset>
  );
}
