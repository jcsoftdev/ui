"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Button } from "../../atoms/button/index.js";
import { useUiStrings } from "../../i18n/index.js";
import { cn } from "../../utils/cn.js";

export interface FormFooterProps extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
  /** Called by the cancel button; without it no cancel button renders. */
  onCancel?: () => void;
  cancelLabel?: string;
  /** Default: the localized "Save". */
  submitLabel?: string;
  /** Submit in flight: the submit button is busy (stays focusable, ignores presses), cancel is disabled. */
  busy?: boolean;
  /** Shows the localized "Unsaved changes" hint (polite live region) beside the actions. */
  dirty?: boolean;
  /** Disables the submit button, e.g. while the form is invalid. */
  submitDisabled?: boolean;
  /** Replaces the dirty hint text. */
  hint?: ReactNode;
  /** Extra actions placed before cancel. */
  children?: ReactNode;
  /** Pins the footer to the bottom of its scroll container. Default `true`. */
  sticky?: boolean;
}

/**
 * Action row of a form: cancel and submit on the end, an optional dirty hint on the start.
 * Sticky by default, so the actions stay in reach in a long form or a drawer. Place it inside the
 * `<form>` so the submit button submits it.
 */
export function FormFooter({
  onCancel,
  cancelLabel,
  submitLabel,
  busy,
  dirty,
  submitDisabled,
  hint,
  children,
  sticky = true,
  className,
  ...props
}: FormFooterProps) {
  const strings = useUiStrings();
  const hintContent = hint ?? (dirty ? strings.unsavedChanges : null);
  return (
    <div
      {...props}
      aria-busy={busy ? "true" : undefined}
      className={cn(
        "@container/form-footer flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 border-line border-t bg-surface py-3",
        sticky && "sticky bottom-0 z-10",
        className,
      )}
    >
      <p role="status" className="me-auto min-w-0 text-meta text-ink-3">
        {hintContent}
      </p>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {children}
        {onCancel ? (
          <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>
            {cancelLabel ?? strings.cancel}
          </Button>
        ) : null}
        <Button type="submit" variant="primary" loading={busy} disabled={submitDisabled}>
          {submitLabel ?? strings.save}
        </Button>
      </div>
    </div>
  );
}
