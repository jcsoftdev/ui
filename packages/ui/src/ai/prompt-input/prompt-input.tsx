"use client";

import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { ArrowUp, Square } from "../../icons/index.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { shouldSubmit } from "./keys.js";

export type PromptInputPart =
  | "root"
  | "box"
  | "attachments"
  | "textarea"
  | "toolbar"
  | "actions"
  | "send"
  | "stop"
  | "hint";

export interface PromptInputProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Called with the trimmed text on Enter or send. Never called when empty. */
  onSubmit?: (value: string) => void;
  /** While true the send button becomes a stop button. */
  streaming?: boolean;
  onStop?: () => void;
  placeholder?: string;
  /** Accessible name of the textarea. */
  label?: string;
  disabled?: boolean;
  /** Rows after which the textarea scrolls instead of growing. */
  maxRows?: number;
  /** Row above the text (Attachment chips). */
  attachments?: ReactNode;
  /** Left of the send button (attach button, model picker…). */
  actions?: ReactNode;
  /** Hint line under the field. */
  hint?: ReactNode;
  className?: string;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<PromptInputPart>;
}

/**
 * Composer: autosizing textarea, Enter to send, Shift+Enter for a new line, attachments slot
 * and a stop button while a response streams.
 */
export function PromptInput({
  value: valueProp,
  defaultValue = "",
  onValueChange,
  onSubmit,
  streaming,
  onStop,
  placeholder = "Escribe un mensaje…",
  label = "Mensaje",
  disabled,
  maxRows = 6,
  attachments,
  actions,
  hint,
  className,
  classNames,
}: PromptInputProps) {
  const [state, setState] = useState(defaultValue);
  const value = valueProp ?? state;
  const area = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    // The value is read so the effect re-measures whenever the text changes.
    void value;
    el.style.height = "auto";
    const line = Number.parseFloat(getComputedStyle(el).lineHeight) || 20;
    const max = line * maxRows;
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
    el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
  }, [value, maxRows]);

  const set = (next: string) => {
    if (valueProp === undefined) setState(next);
    onValueChange?.(next);
  };

  const submit = () => {
    const text = value.trim();
    if (!text || disabled || streaming) return;
    onSubmit?.(text);
    set("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      shouldSubmit({
        key: event.key,
        shiftKey: event.shiftKey,
        isComposing: event.nativeEvent.isComposing,
      })
    ) {
      event.preventDefault();
      submit();
    }
  };

  const onFormSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (streaming) onStop?.();
    else submit();
  };

  const canSend = value.trim().length > 0 && !disabled;

  return (
    <form
      onSubmit={onFormSubmit}
      className={cn("@container/prompt grid min-w-0 gap-1", classNames?.root, className)}
    >
      <div
        className={cn(
          "grid gap-density-sm rounded-card bg-surface-control p-2 text-ink border-control shadow-control focus-within:focus-ring",
          classNames?.box,
        )}
      >
        {attachments ? (
          <div className={cn("flex flex-wrap gap-density-sm", classNames?.attachments)}>
            {attachments}
          </div>
        ) : null}
        <textarea
          ref={area}
          rows={1}
          value={value}
          disabled={disabled}
          aria-label={label}
          placeholder={placeholder}
          onChange={(event) => set(event.target.value)}
          onKeyDown={onKeyDown}
          className={cn(
            "block max-h-none w-full min-w-0 resize-none bg-transparent px-1 py-1 text-body leading-normal text-ink outline-none placeholder:text-ink-3 disabled:cursor-not-allowed",
            classNames?.textarea,
          )}
        />
        <div
          className={cn("flex items-center justify-between gap-density-sm", classNames?.toolbar)}
        >
          <div className={cn("flex min-w-0 items-center gap-density-sm", classNames?.actions)}>
            {actions}
          </div>
          {streaming ? (
            <button
              type="submit"
              aria-label="Detener respuesta"
              className={cn(
                "inline-grid size-8 shrink-0 cursor-pointer place-items-center rounded-button bg-ink text-bg pressable focus-visible:focus-ring",
                classNames?.stop,
              )}
            >
              <Square aria-hidden className="size-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              aria-label="Enviar mensaje"
              disabled={!canSend}
              className={cn(
                "inline-grid size-8 shrink-0 cursor-pointer place-items-center rounded-button bg-accent text-on-accent pressable focus-visible:focus-ring disabled:cursor-not-allowed disabled:opacity-45",
                classNames?.send,
              )}
            >
              <ArrowUp aria-hidden className="size-4" />
            </button>
          )}
        </div>
      </div>
      {hint ? <p className={cn("px-1 text-meta text-ink-3", classNames?.hint)}>{hint}</p> : null}
    </form>
  );
}
