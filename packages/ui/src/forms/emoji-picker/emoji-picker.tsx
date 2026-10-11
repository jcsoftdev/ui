"use client";

import { type KeyboardEvent, useId, useMemo, useRef, useState } from "react";
import { Search } from "../../icons/index.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { EMOJI_CATEGORIES, type EmojiCategory, type EmojiEntry } from "./emoji-data.js";
import { gridMove, searchEmojis } from "./model.js";

export type EmojiPickerPart =
  | "root"
  | "search"
  | "searchIcon"
  | "searchInput"
  | "categories"
  | "category"
  | "title"
  | "grid"
  | "emoji"
  | "empty";

export interface EmojiPickerProps {
  onSelect?: (emoji: string) => void;
  /** Replaces the built-in dataset (`EMOJI_CATEGORIES`). */
  categories?: EmojiCategory[];
  /** Initial category id. */
  defaultCategory?: string;
  searchPlaceholder?: string;
  className?: string;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<EmojiPickerPart>;
}

/**
 * Emoji panel with search, category tabs and a keyboard-navigable grid (arrows, Home/End; Enter or
 * Space picks). The panel adapts to its container width and holds no portal, so it works inline or
 * inside a popover.
 */
export function EmojiPicker({
  onSelect,
  categories = EMOJI_CATEGORIES,
  defaultCategory,
  searchPlaceholder = "Buscar emoji",
  className,
  classNames,
}: EmojiPickerProps) {
  const baseId = useId();
  const grid = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState(defaultCategory ?? categories[0]?.id);
  const [active, setActive] = useState(0);

  const searching = query.trim().length > 0;
  const category = categories.find((c) => c.id === categoryId) ?? categories[0];
  const entries: EmojiEntry[] = useMemo(
    () => (searching ? searchEmojis(categories, query) : (category?.emojis ?? [])),
    [searching, categories, query, category],
  );
  const current = Math.min(active, Math.max(0, entries.length - 1));

  const columns = () => {
    const template = grid.current ? getComputedStyle(grid.current).gridTemplateColumns : "";
    return Math.max(1, template.split(" ").filter(Boolean).length);
  };

  const focusCell = (index: number) => {
    setActive(index);
    grid.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = gridMove(event.key, current, columns(), entries.length);
    if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End"].includes(event.key))
      return;
    event.preventDefault();
    focusCell(next);
  };

  return (
    <div
      className={cn(
        "@container/emoji flex w-full max-w-xs min-w-0 flex-col gap-density-sm rounded-popover border-card bg-surface-overlay p-card text-ink",
        classNames?.root,
        className,
      )}
    >
      <label className={cn("relative flex items-center", classNames?.search)}>
        <span className="sr-only">{searchPlaceholder}</span>
        <Search
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute left-2.5 size-3.5 text-ink-3",
            classNames?.searchIcon,
          )}
        />
        <input
          type="search"
          value={query}
          placeholder={searchPlaceholder}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          className={cn(
            "h-control-sm w-full min-w-0 rounded-input border-control bg-surface-control pr-2 pl-8 text-control text-ink placeholder:text-ink-3 focus:border-transparent focus:outline-2 focus:outline-accent-ink focus:-outline-offset-1",
            classNames?.searchInput,
          )}
        />
      </label>

      {searching ? null : (
        <div
          role="toolbar"
          aria-label="Categorías"
          className={cn("flex flex-wrap gap-0.5", classNames?.categories)}
        >
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              title={c.label}
              aria-label={c.label}
              aria-pressed={c.id === category?.id}
              onClick={() => {
                setCategoryId(c.id);
                setActive(0);
              }}
              className={cn(
                "pressable grid size-8 place-items-center rounded-button text-base hover:bg-surface-sunken aria-pressed:bg-accent-soft focus-visible:focus-ring",
                classNames?.category,
              )}
            >
              <span aria-hidden="true">{c.icon}</span>
            </button>
          ))}
        </div>
      )}

      <p id={`${baseId}-title`} className={cn("text-ink-3 text-overline", classNames?.title)}>
        {searching ? `Resultados (${entries.length})` : category?.label}
      </p>

      {/* biome-ignore lint/a11y/useSemanticElements: arrow-key grid of buttons with a roving tabindex */}
      <div
        ref={grid}
        role="group"
        aria-labelledby={`${baseId}-title`}
        onKeyDown={onKeyDown}
        className={cn(
          "grid max-h-48 gap-0.5 overflow-y-auto [grid-template-columns:repeat(auto-fill,minmax(2rem,1fr))]",
          classNames?.grid,
        )}
      >
        {entries.map((entry, index) => (
          <button
            key={entry.emoji}
            type="button"
            data-index={index}
            tabIndex={index === current ? 0 : -1}
            aria-label={entry.name.split(" ").slice(0, 3).join(" ")}
            title={entry.name.split(" ").slice(0, 3).join(" ")}
            onFocus={() => setActive(index)}
            onClick={() => onSelect?.(entry.emoji)}
            className={cn(
              "pressable grid size-8 place-items-center rounded-button text-lg hover:bg-surface-sunken focus-visible:focus-ring",
              classNames?.emoji,
            )}
          >
            <span aria-hidden="true">{entry.emoji}</span>
          </button>
        ))}
        {entries.length === 0 ? (
          <p
            className={cn("col-span-full py-3 text-center text-ink-3 text-meta", classNames?.empty)}
          >
            Sin resultados
          </p>
        ) : null}
      </div>
    </div>
  );
}
