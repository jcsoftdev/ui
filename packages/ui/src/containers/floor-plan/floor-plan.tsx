"use client";

import { type CSSProperties, type ReactNode, useRef } from "react";
import type { TableShape } from "../../atoms/table-glyph/layout.js";
import { TableGlyph, type TableGlyphPattern } from "../../atoms/table-glyph/table-glyph.js";
import { useUiStrings } from "../../i18n/index.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { useComposedRefs } from "../../utils/compose.js";
import { useRovingFocus } from "../../utils/roving-focus.js";
import { customToneStyle, isCustomTone } from "../../utils/tone.js";
import { useContainerWidth } from "../../utils/use-container-width.js";
import { DEFAULT_PX_PER_UNIT, groupOutlines, labelPlacement, percentBox } from "./model.js";

export type FloorPlanBuiltinTone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

/** A built-in tone, or the name of a tone declared in `tonePalettes`. */
export type FloorPlanTone = FloorPlanBuiltinTone | (string & {});

export type FloorPlanRing = "none" | "late" | "selected";

export interface FloorPlanItem {
  id: string;
  /** Position and size in grid units. */
  x: number;
  y: number;
  width: number;
  height: number;
  shape: TableShape;
  seats: number;
  /** Chairs drawn as taken. */
  occupied?: number | undefined;
  /** Table name; always visible, inside the table or under it on small shapes. */
  label: string;
  /** Text of the state. Pair it with `statusIcon`: the state is never carried by colour alone. */
  statusLabel?: string | undefined;
  /** Decorative glyph shown before `statusLabel`. */
  statusIcon?: ReactNode;
  /** Colour of the table and the status glyph. Defaults to `neutral`. */
  tone?: FloorPlanTone | undefined;
  /** Table surface; see `TableGlyph`. Defaults to `solid`. */
  pattern?: TableGlyphPattern | undefined;
  /** A uniform ring around the whole item: `late` (danger) or `selected` (accent). `selectedId` wins over it. */
  ring?: FloorPlanRing | undefined;
  /** Items sharing a `groupId` (merged tables) get one outline around the group. */
  groupId?: string | undefined;
}

export interface FloorPlanLandmark {
  id: string;
  /** What it is (`wall`, `door`, `bar`, `stairs`, `restroom`...); exposed as `data-kind`. */
  kind: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type FloorPlanPart =
  | "root"
  | "canvas"
  | "item"
  | "glyph"
  | "label"
  | "status"
  | "landmark"
  | "group";

export interface FloorPlanProps {
  /** Canvas size in grid units. The canvas fills its container and keeps this aspect ratio. */
  width: number;
  height: number;
  items: readonly FloorPlanItem[];
  landmarks?: readonly FloorPlanLandmark[];
  /** Controlled selection; the item gets the selected ring and `aria-pressed`. */
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** Accessible name of the plan. Defaults to the localized "Floor plan". */
  "aria-label"?: string;
  className?: string;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<FloorPlanPart>;
}

const toneClasses: Record<FloorPlanBuiltinTone, string> = {
  neutral: "text-ink-2",
  accent: "text-accent",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-info",
};

const builtinTones = new Set<string>(Object.keys(toneClasses));

const ringClasses: Record<FloorPlanRing, string> = {
  none: "",
  late: "ring-2 ring-danger",
  selected: "ring-2 ring-accent",
};

const hatch =
  "bg-[repeating-linear-gradient(135deg,var(--line-strong)_0_1px,transparent_1px_7px)] border border-line-strong";

function format(template: string, count: number): string {
  return template.replace("{count}", String(count));
}

/**
 * A read-only salon plan on a logical-unit canvas. The canvas fills its container and keeps the
 * `width` x `height` aspect ratio, and every item is placed in percentages of it, so hit areas
 * always match what is drawn. Items are buttons in array order with roving arrow-key focus. A
 * state shows as an icon plus text (never colour alone), `late` and `selected` as one ring around
 * the whole item, and the label moves under the shape when the table is too small to hold it.
 */
export function FloorPlan({
  width,
  height,
  items,
  landmarks = [],
  selectedId,
  onSelect,
  "aria-label": ariaLabel,
  className,
  classNames,
}: FloorPlanProps) {
  const strings = useUiStrings();
  const canvasRef = useRef<HTMLDivElement>(null);
  const measured = useContainerWidth(canvasRef);
  const pxPerUnit = measured === null ? DEFAULT_PX_PER_UNIT : measured / width;
  const { rootProps, getItemProps } = useRovingFocus({ activeId: selectedId ?? null });
  const rootRef = useComposedRefs(canvasRef, rootProps.ref);
  const selectable = onSelect !== undefined || selectedId !== undefined;
  const outlines = groupOutlines(items);

  return (
    <div className={cn("@container/floor w-full", classNames?.root, className)}>
      {/* biome-ignore lint/a11y/useSemanticElements: the canvas is a positioned div; a fieldset cannot be laid out as a canvas */}
      <div
        {...rootProps}
        ref={rootRef}
        role="group"
        aria-label={ariaLabel ?? strings.floorPlan}
        style={{ aspectRatio: `${width} / ${height}` }}
        className={cn(
          "relative w-full rounded-card border border-line bg-surface-sunken focus-visible:focus-ring",
          classNames?.canvas,
        )}
      >
        {landmarks.map((landmark) => (
          <div
            key={landmark.id}
            data-kind={landmark.kind}
            style={percentBox(landmark, width, height)}
            className={cn(
              "absolute flex items-center justify-center overflow-hidden rounded-control p-0.5 text-center text-ink-2 text-meta",
              hatch,
              classNames?.landmark,
            )}
          >
            <span className="max-w-full truncate rounded-chip bg-surface px-1">
              {landmark.label}
            </span>
          </div>
        ))}
        {outlines.map((outline) => (
          <div
            key={outline.groupId}
            aria-hidden="true"
            data-group={outline.groupId}
            style={percentBox(outline, width, height)}
            className={cn(
              "pointer-events-none absolute rounded-card border border-ink-3 border-dashed",
              classNames?.group,
            )}
          />
        ))}
        {items.map((item) => {
          const selected = selectedId === item.id || item.ring === "selected";
          const ring: FloorPlanRing = selected ? "selected" : (item.ring ?? "none");
          const tone = item.tone ?? "neutral";
          const placement = labelPlacement(item, pxPerUnit);
          const hasStatus = item.statusLabel !== undefined || item.statusIcon !== undefined;
          const style: CSSProperties | undefined = customToneStyle(
            tone,
            builtinTones,
            percentBox(item, width, height),
          );
          return (
            <button
              key={item.id}
              type="button"
              data-item={item.id}
              data-shape={item.shape}
              data-tone={tone === "neutral" ? undefined : tone}
              data-ring={ring === "none" ? undefined : ring}
              data-label={placement}
              data-selected={selected ? "" : undefined}
              aria-pressed={selectable ? selected : undefined}
              style={style}
              {...getItemProps(item.id)}
              onClick={() => onSelect?.(item.id)}
              className={cn(
                "absolute block rounded-control p-0 text-ink focus-visible:focus-ring",
                isCustomTone(tone, builtinTones)
                  ? "text-(--tone-c)"
                  : (toneClasses[tone as FloorPlanBuiltinTone] ?? toneClasses.neutral),
                ringClasses[ring],
                classNames?.item,
              )}
            >
              <TableGlyph
                shape={item.shape}
                seats={item.seats}
                occupied={item.occupied ?? 0}
                width={item.width}
                height={item.height}
                pattern={item.pattern}
                size="fill"
                className={cn(
                  "pointer-events-none absolute inset-0 text-current",
                  classNames?.glyph,
                )}
              />
              <span
                className={cn(
                  "pointer-events-none flex flex-col items-center text-center",
                  placement === "inside"
                    ? "absolute inset-0 justify-center"
                    : "absolute inset-x-0 top-full pt-0.5",
                  classNames?.label,
                )}
              >
                <span className="whitespace-nowrap font-bold text-ink text-meta">{item.label}</span>
                {hasStatus ? (
                  <span
                    className={cn(
                      "inline-flex items-center gap-0.5 whitespace-nowrap text-ink-2 text-count",
                      classNames?.status,
                    )}
                  >
                    {item.statusIcon ? (
                      <span aria-hidden="true" className="inline-flex shrink-0 text-current">
                        {item.statusIcon}
                      </span>
                    ) : null}
                    {item.statusLabel}
                  </span>
                ) : null}
              </span>
              <span className="sr-only">
                {format(item.seats === 1 ? strings.seatsOne : strings.seats, item.seats)}
                {item.ring === "late" ? `, ${strings.late}` : ""}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
