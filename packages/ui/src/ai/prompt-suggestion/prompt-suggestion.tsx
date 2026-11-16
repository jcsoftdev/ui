import type { ComponentPropsWithRef } from "react";
import { intentAttributes } from "../../intent/attributes.js";
import type { IntentProps } from "../../intent/types.js";
import { cn } from "../../utils/cn.js";

export interface PromptSuggestionProps
  extends Omit<ComponentPropsWithRef<"button">, "onSelect" | "children">,
    IntentProps {
  /** Receives the suggestion text when pressed (the visible label is the text). */
  onSelect?: (text: string) => void;
  children: string;
}

/** Chip with a suggested prompt. Pressing it hands the text to `onSelect`. */
export function PromptSuggestion({
  onSelect,
  children,
  className,
  onClick,
  intent,
  intentKey,
  ...props
}: PromptSuggestionProps) {
  return (
    <button
      type="button"
      {...intentAttributes({ intent, intentKey })}
      onClick={(event) => {
        onClick?.(event);
        onSelect?.(children);
      }}
      className={cn(
        "inline-flex h-control-sm min-w-0 max-w-full cursor-pointer items-center rounded-button bg-surface-control px-3 text-meta text-ink-2 border-control shadow-control pressable hover:bg-surface-2 hover:text-ink focus-visible:focus-ring",
        className,
      )}
      {...props}
    >
      <span className="truncate">{children}</span>
    </button>
  );
}

export interface PromptSuggestionListProps extends ComponentPropsWithRef<"fieldset"> {
  label?: string;
}

/** Wrapping group of suggestion chips. */
export function PromptSuggestionList({
  label = "Sugerencias",
  className,
  ...props
}: PromptSuggestionListProps) {
  return (
    <fieldset
      aria-label={label}
      className={cn("@container/suggest flex min-w-0 flex-wrap gap-density-sm", className)}
      {...props}
    />
  );
}
