"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import { SmilePlus } from "lucide-react";
import { useState } from "react";
import { cn } from "../../utils/cn.js";
import { EmojiPicker } from "../emoji-picker/emoji-picker.js";

export interface EmojiReactionButtonProps {
  emoji: string;
  count: number;
  /** Whether the current user has used this reaction. */
  reacted?: boolean;
  onToggle?: (reacted: boolean) => void;
  disabled?: boolean;
  className?: string;
}

/** Reaction chip: an emoji with its count, pressed when the current user reacted. */
export function EmojiReactionButton({
  emoji,
  count,
  reacted = false,
  onToggle,
  disabled,
  className,
}: EmojiReactionButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={reacted}
      aria-label={`${emoji} ${count}`}
      disabled={disabled}
      onClick={() => onToggle?.(!reacted)}
      className={cn(
        "pressable inline-flex h-control-sm items-center gap-1.5 rounded-badge border-control bg-surface-control px-2.5 text-control text-ink-2 tabular-nums hover:bg-surface-sunken focus-visible:focus-ring disabled:cursor-not-allowed disabled:opacity-50 aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-accent-ink",
        className,
      )}
    >
      <span aria-hidden="true">{emoji}</span>
      <span aria-hidden="true">{count}</span>
    </button>
  );
}

export interface Reaction {
  emoji: string;
  count: number;
  reacted?: boolean;
}

export interface EmojiReactionBarProps {
  reactions: Reaction[];
  /** Called with the emoji and the new reacted state, from a chip or from the picker. */
  onReact?: (emoji: string, reacted: boolean) => void;
  /** Portal target for the picker; pass an element to keep a scoped `data-style`. */
  container?: HTMLElement | null;
  addLabel?: string;
  disabled?: boolean;
  className?: string;
}

/** Row of reaction chips plus an "add reaction" button that opens an emoji picker. */
export function EmojiReactionBar({
  reactions,
  onReact,
  container,
  addLabel = "Añadir reacción",
  disabled,
  className,
}: EmojiReactionBarProps) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={cn("@container/reactions flex flex-wrap items-center gap-density-sm", className)}
    >
      {reactions.map((reaction) => (
        <EmojiReactionButton
          key={reaction.emoji}
          {...reaction}
          disabled={disabled}
          onToggle={(next) => onReact?.(reaction.emoji, next)}
        />
      ))}
      <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
        <PopoverPrimitive.Trigger
          disabled={disabled}
          aria-label={addLabel}
          className="pressable grid aspect-square h-control-sm place-items-center rounded-badge border-control bg-surface-control text-ink-3 hover:text-ink focus-visible:focus-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <SmilePlus aria-hidden="true" className="size-4" />
        </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal container={container}>
          <PopoverPrimitive.Content
            sideOffset={6}
            collisionPadding={8}
            className="z-85 w-72 max-w-(--radix-popover-content-available-width) rounded-popover shadow-overlay"
          >
            <EmojiPicker
              className="max-w-none surface-overlay"
              onSelect={(emoji) => {
                const existing = reactions.find((r) => r.emoji === emoji);
                onReact?.(emoji, !existing?.reacted);
                setOpen(false);
              }}
            />
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </div>
  );
}
