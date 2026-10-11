"use client";

import { useState } from "react";
import { SmilePlus } from "../../icons/index.js";
import * as PopoverPrimitive from "../../primitives/popover/popover.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { EmojiPicker } from "../emoji-picker/emoji-picker.js";

export type EmojiReactionButtonPart = "root" | "emoji" | "count";

export interface EmojiReactionButtonProps {
  emoji: string;
  count: number;
  /** Whether the current user has used this reaction. */
  reacted?: boolean;
  onToggle?: (reacted: boolean) => void;
  disabled?: boolean;
  className?: string;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<EmojiReactionButtonPart>;
}

/** Reaction chip: an emoji with its count, pressed when the current user reacted. */
export function EmojiReactionButton({
  emoji,
  count,
  reacted = false,
  onToggle,
  disabled,
  className,
  classNames,
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
        classNames?.root,
        className,
      )}
    >
      <span aria-hidden="true" className={classNames?.emoji}>
        {emoji}
      </span>
      <span aria-hidden="true" className={classNames?.count}>
        {count}
      </span>
    </button>
  );
}

export interface Reaction {
  emoji: string;
  count: number;
  reacted?: boolean;
}

export type EmojiReactionBarPart = "root" | "reaction" | "add" | "popover" | "picker";

export interface EmojiReactionBarProps {
  reactions: Reaction[];
  /** Called with the emoji and the new reacted state, from a chip or from the picker. */
  onReact?: (emoji: string, reacted: boolean) => void;
  /** Portal target for the picker; pass an element to keep a scoped `data-style`. */
  container?: HTMLElement | null;
  addLabel?: string;
  disabled?: boolean;
  className?: string;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<EmojiReactionBarPart>;
}

/** Row of reaction chips plus an "add reaction" button that opens an emoji picker. */
export function EmojiReactionBar({
  reactions,
  onReact,
  container,
  addLabel = "Añadir reacción",
  disabled,
  className,
  classNames,
}: EmojiReactionBarProps) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={cn(
        "@container/reactions flex flex-wrap items-center gap-density-sm",
        classNames?.root,
        className,
      )}
    >
      {reactions.map((reaction) => (
        <EmojiReactionButton
          key={reaction.emoji}
          {...reaction}
          className={classNames?.reaction}
          disabled={disabled}
          onToggle={(next) => onReact?.(reaction.emoji, next)}
        />
      ))}
      <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
        <PopoverPrimitive.Trigger
          disabled={disabled}
          aria-label={addLabel}
          className={cn(
            "pressable grid aspect-square h-control-sm place-items-center rounded-badge border-control bg-surface-control text-ink-3 hover:text-ink focus-visible:focus-ring disabled:cursor-not-allowed disabled:opacity-50",
            classNames?.add,
          )}
        >
          <SmilePlus aria-hidden="true" className="size-4" />
        </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal container={container}>
          <PopoverPrimitive.Content
            sideOffset={6}
            collisionPadding={8}
            className={cn(
              "z-85 w-72 max-w-(--ui-popper-available-width) rounded-popover shadow-overlay",
              classNames?.popover,
            )}
          >
            <EmojiPicker
              className={cn("max-w-none surface-overlay", classNames?.picker)}
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
