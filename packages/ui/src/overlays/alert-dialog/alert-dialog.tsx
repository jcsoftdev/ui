"use client";

import {
  type ReactElement,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button } from "../../atoms/button/button.js";
import type { ConfirmResult } from "../../containers/confirm-action/model.js";
import { runConfirm } from "../../containers/confirm-action/model.js";
import { useUiStrings } from "../../i18n/index.js";
import * as DialogPrimitive from "../../primitives/dialog/dialog.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { type Material, materialClass } from "../../utils/material.js";
import { useControllableState } from "../../utils/use-controllable-state.js";
import {
  PreviousFocusProvider,
  restoreFocusOnClose,
  useCapturePreviousFocus,
  usePreviousFocus,
} from "../focus-return/index.js";

export type AlertDialogTone = "default" | "danger";

export type AlertDialogPart =
  | "overlay"
  | "root"
  | "header"
  | "title"
  | "description"
  | "body"
  | "error"
  | "footer"
  | "cancel"
  | "confirm";

export interface AlertDialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Element that opens the dialog. Omit it to drive the dialog with `open`. */
  trigger?: ReactElement;
  /** What is being asked, as a question or a verb phrase ("Delete this appointment?"). */
  title: ReactNode;
  /** The consequence, said plainly. Linked to the dialog with `aria-describedby`. */
  description?: ReactNode;
  /** Extra content between the description and the buttons. */
  children?: ReactNode;
  /** `danger` styles the confirm button as destructive. */
  tone?: AlertDialogTone;
  /** Defaults to the localized "Confirm". */
  confirmLabel?: string;
  /** Defaults to the localized "Cancel". */
  cancelLabel?: string;
  /**
   * Runs on confirm. The dialog shows a pending state, ignores a second press and cannot be
   * dismissed until it settles, then closes. Return `{ ok: false, error }` or throw to keep
   * it open with a message.
   */
  onConfirm: () => Promise<ConfirmResult> | Promise<void>;
  /** Runs when the user cancels (Cancel button or Escape), not when a confirm succeeds. */
  onCancel?: () => void;
  /** Which button gets focus when the dialog opens. Cancel is the safe default. */
  initialFocus?: "cancel" | "confirm";
  /** Surface material; see `DialogContent`. */
  material?: Material;
  /** Portal target. Defaults to `document.body`; pass an element to keep a scoped `data-style`. */
  container?: HTMLElement | null;
  className?: string;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the panel and is merged last. */
  classNames?: ClassNames<AlertDialogPart>;
}

/**
 * Modal that interrupts to ask for a decision before something consequential
 * (WAI-ARIA `alertdialog`). There is no close button and a press outside does nothing:
 * the user answers with Cancel, Escape or Confirm. While `onConfirm` is pending, every way
 * out is disabled so the action runs exactly once.
 */
export function AlertDialog({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  tone = "default",
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  initialFocus = "cancel",
  material,
  container,
  className,
  classNames,
}: AlertDialogProps) {
  const strings = useUiStrings();
  const [open, setOpen] = useControllableState({
    prop: openProp,
    defaultProp: defaultOpen,
    onChange: onOpenChange,
  });
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const pendingRef = useRef(false);
  const mounted = useRef(true);
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const focusRef = useCapturePreviousFocus(open);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (open) setFailure(null);
  }, [open]);

  // After a failure the buttons are enabled again: put focus on the safe one.
  useEffect(() => {
    if (!pending && failure !== null) cancelRef.current?.focus();
  }, [pending, failure]);

  const requestOpen = useCallback(
    (next: boolean) => {
      if (!next && pendingRef.current) return;
      setOpen(next);
    },
    [setOpen],
  );

  const cancel = useCallback(() => {
    if (pendingRef.current) return;
    onCancel?.();
    setOpen(false);
  }, [onCancel, setOpen]);

  const confirm = useCallback(async () => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setFailure(null);
    // The confirm button is about to be disabled: park focus on the panel so it is not lost.
    panelRef.current?.focus();
    const outcome = await runConfirm(onConfirm, strings.actionFailed);
    pendingRef.current = false;
    if (!mounted.current) return;
    setPending(false);
    if (outcome.status === "failed") setFailure(outcome.message);
    else {
      setOpen(false);
    }
  }, [onConfirm, setOpen, strings.actionFailed]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={requestOpen}>
      <PreviousFocusProvider focusRef={focusRef}>
        {trigger ? <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger> : null}
        <AlertDialogPanel
          panelRef={panelRef}
          material={material}
          container={container}
          className={className}
          classNames={classNames}
          onEscape={(event) => {
            if (pendingRef.current) event.preventDefault();
            else onCancel?.();
          }}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            (initialFocus === "confirm" ? confirmRef : cancelRef).current?.focus();
          }}
        >
          <div className={cn("flex flex-col gap-1 px-4.5 pt-4 pb-2.5", classNames?.header)}>
            <DialogPrimitive.Title
              className={cn(
                "m-0 min-w-0 break-words text-dialog-title text-ink",
                classNames?.title,
              )}
            >
              {title}
            </DialogPrimitive.Title>
            {description === undefined ? null : (
              <DialogPrimitive.Description
                className={cn("m-0 text-body text-ink-2", classNames?.description)}
              >
                {description}
              </DialogPrimitive.Description>
            )}
          </div>
          {children === undefined && failure === null ? null : (
            <div className={cn("flex flex-col gap-3 px-4.5 pb-3", classNames?.body)}>
              {children}
              {failure === null ? null : (
                <p role="alert" className={cn("m-0 text-body text-danger", classNames?.error)}>
                  {failure}
                </p>
              )}
            </div>
          )}
          <div
            data-tone={tone}
            className={cn(
              "flex flex-wrap items-center justify-end gap-2 border-t-divider px-4.5 py-3",
              "@max-sm/dialog:flex-col-reverse @max-sm/dialog:items-stretch @max-sm/dialog:[&>*]:w-full",
              classNames?.footer,
            )}
          >
            <Button
              ref={cancelRef}
              variant="secondary"
              disabled={pending}
              className={classNames?.cancel}
              onClick={cancel}
            >
              {cancelLabel ?? strings.cancel}
            </Button>
            <Button
              ref={confirmRef}
              variant={tone === "danger" ? "danger" : "primary"}
              loading={pending}
              loadingLabel={strings.processing}
              className={classNames?.confirm}
              onClick={() => void confirm()}
            >
              {confirmLabel ?? strings.confirm}
            </Button>
          </div>
        </AlertDialogPanel>
      </PreviousFocusProvider>
    </DialogPrimitive.Root>
  );
}

interface AlertDialogPanelProps {
  children: ReactNode;
  panelRef: RefObject<HTMLDivElement | null>;
  material: Material | undefined;
  container: HTMLElement | null | undefined;
  className: string | undefined;
  classNames: ClassNames<AlertDialogPart> | undefined;
  onEscape: (event: KeyboardEvent) => void;
  onOpenAutoFocus: (event: Event) => void;
}

function AlertDialogPanel({
  children,
  panelRef,
  material,
  container,
  className,
  classNames,
  onEscape,
  onOpenAutoFocus,
}: AlertDialogPanelProps) {
  const previousFocusRef = usePreviousFocus();
  return (
    <DialogPrimitive.Portal container={container}>
      <DialogPrimitive.Overlay className={cn("fixed inset-0 z-70 bg-scrim", classNames?.overlay)} />
      <DialogPrimitive.Content
        ref={panelRef}
        role="alertdialog"
        onEscapeKeyDown={onEscape}
        // Answered with the buttons: pressing outside never answers for the user.
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        onOpenAutoFocus={onOpenAutoFocus}
        onCloseAutoFocus={(event) => restoreFocusOnClose(event, previousFocusRef)}
        className={cn(
          "@container/dialog fixed top-[9dvh] left-1/2 z-70 flex max-h-[84dvh] w-[min(420px,100%)] max-w-full -translate-x-1/2 flex-col overflow-auto rounded-dialog outline-none surface-overlay shadow-overlay",
          materialClass(material, "surface-solid"),
          classNames?.root,
          className,
        )}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
