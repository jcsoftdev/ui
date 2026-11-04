"use client";

import { type CSSProperties, type ReactNode, useId, useRef } from "react";
import type { TableShape } from "../../atoms/table-glyph/layout.js";
import { TableGlyph, type TableGlyphPattern } from "../../atoms/table-glyph/table-glyph.js";
import { useUiStrings } from "../../i18n/index.js";
import { RotateCcw } from "../../icons/index.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { useComposedRefs } from "../../utils/compose.js";
import { useRovingFocus } from "../../utils/roving-focus.js";
import { customToneStyle, isCustomTone } from "../../utils/tone.js";
import { useContainerWidth } from "../../utils/use-container-width.js";
import type { ResizeHandle } from "./edit-model.js";
import { DEFAULT_PX_PER_UNIT, groupOutlines, labelPlacement, percentBox } from "./model.js";
import { useFloorPlanEdit } from "./use-floor-plan-edit.js";

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
  | "group"
  | "handle"
  | "rotate";

export interface FloorPlanProps {
  /** Canvas size in grid units. The canvas fills its container and keeps this aspect ratio. */
  width: number;
  height: number;
  items: readonly FloorPlanItem[];
  landmarks?: readonly FloorPlanLandmark[];
  /** Controlled selection; the item gets the selected ring and `aria-pressed`. */
  selectedId?: string | null;
  /** Called with the id of the item or landmark that was picked, by click, keyboard or the start of a drag. */
  onSelect?: (id: string) => void;
  /**
   * Lets people rearrange the plan: drag an item or landmark to move it, drag a corner handle of
   * the selected one to resize, press the rotate button or `r` to turn it a quarter, Alt with an
   * arrow to nudge and Alt and Shift with an arrow to resize. Edits snap to `snap`, stay inside the
   * canvas and are reported through `onChange`; the plan stays controlled by `items` and `landmarks`.
   * Edited boxes are not checked against each other, so overlaps are possible.
   */
  editable?: boolean;
  /** Receives the full lists with the edited box applied; called once per drop and once per key press. */
  onChange?: (items: FloorPlanItem[], landmarks: FloorPlanLandmark[]) => void;
  /** Grid step in units that positions and sizes snap to while editing. Defaults to 1. */
  snap?: number;
  /** Smallest width or height in units while editing. Defaults to 1. */
  minSize?: number;
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

const HANDLES: readonly ResizeHandle[] = ["nw", "ne", "sw", "se"];

const handleClasses: Partial<Record<ResizeHandle, string>> = {
  nw: "-top-1.5 -left-1.5 cursor-nwse-resize",
  ne: "-top-1.5 -right-1.5 cursor-nesw-resize",
  sw: "-bottom-1.5 -left-1.5 cursor-nesw-resize",
  se: "-right-1.5 -bottom-1.5 cursor-nwse-resize",
};

const hatch =
  "bg-[repeating-linear-gradient(135deg,var(--line-strong)_0_1px,transparent_1px_7px)] border border-line-strong";

function format(template: string, count: number): string {
  return template.replace("{count}", String(count));
}

/**
 * A salon plan on a logical-unit canvas, read-only unless `editable`. The canvas fills its container and keeps the
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
  editable = false,
  onChange,
  snap = 1,
  minSize = 1,
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
  const hintId = useId();
  const edit = useFloorPlanEdit({
    enabled: editable,
    items,
    landmarks,
    bounds: { width, height, snap, minSize },
    canvasRef,
    onChange,
    onSelect,
  });
  const shownItems = items.map(edit.view);
  const shownLandmarks = landmarks.map(edit.view);
  const outlines = groupOutlines(shownItems);
  const selectedBox = editable
    ? [...shownItems, ...shownLandmarks].find((entry) => entry.id === selectedId)
    : undefined;
  const selectedSource = selectedBox
    ? [...items, ...landmarks].find((entry) => entry.id === selectedBox.id)
    : undefined;

  return (
    <div className={cn("@container/floor w-full", classNames?.root, className)}>
      {/* biome-ignore lint/a11y/useSemanticElements: the canvas is a positioned div; a fieldset cannot be laid out as a canvas */}
      <div
        {...rootProps}
        ref={rootRef}
        role="group"
        aria-label={ariaLabel ?? strings.floorPlan}
        style={{
          aspectRatio: `${width} / ${height}`,
          ...(editable
            ? {
                backgroundImage: "radial-gradient(circle, var(--line-strong) 1px, transparent 1px)",
                backgroundSize: `${100 / width}% ${100 / height}%`,
              }
            : null),
        }}
        data-editable={editable ? "" : undefined}
        className={cn(
          "relative w-full rounded-card border border-line bg-surface-sunken focus-visible:focus-ring",
          classNames?.canvas,
        )}
      >
        {editable ? (
          <p id={hintId} className="sr-only">
            {strings.floorPlanEditHint}
          </p>
        ) : null}
        {shownLandmarks.map((landmark) => {
          const common = {
            "data-kind": landmark.kind,
            style: percentBox(landmark, width, height),
            className: cn(
              "absolute flex items-center justify-center overflow-hidden rounded-control p-0.5 text-center text-ink-2 text-meta",
              hatch,
              classNames?.landmark,
            ),
          };
          const label = (
            <span className="max-w-full truncate rounded-chip bg-surface px-1">
              {landmark.label}
            </span>
          );
          if (!editable) {
            return (
              <div key={landmark.id} {...common}>
                {label}
              </div>
            );
          }
          const selected = selectedId === landmark.id;
          return (
            <button
              key={landmark.id}
              type="button"
              data-landmark={landmark.id}
              aria-pressed={selectable ? selected : undefined}
              aria-describedby={hintId}
              {...common}
              className={cn(
                common.className,
                "cursor-grab touch-none focus-visible:focus-ring active:cursor-grabbing",
                selected && "ring-2 ring-accent",
              )}
              {...getItemProps(landmark.id, { onKeyDown: edit.onKeyDown(landmark) })}
              {...edit.dragProps(landmark, "move")}
              onClick={() => onSelect?.(landmark.id)}
            >
              <span className="sr-only">{landmark.label}</span>
              <span aria-hidden="true" className="contents">
                {label}
              </span>
            </button>
          );
        })}
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
        {shownItems.map((item) => {
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
              aria-describedby={editable ? hintId : undefined}
              {...getItemProps(item.id, { onKeyDown: edit.onKeyDown(item) })}
              {...(editable ? edit.dragProps(item, "move") : null)}
              onClick={() => onSelect?.(item.id)}
              className={cn(
                "absolute block rounded-control p-0 text-ink focus-visible:focus-ring",
                editable && "cursor-grab touch-none active:cursor-grabbing",
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
        {selectedBox && selectedSource ? (
          <div
            data-edit-overlay={selectedBox.id}
            style={percentBox(selectedBox, width, height)}
            className="pointer-events-none absolute"
          >
            {HANDLES.map((handle) => (
              <span
                key={handle}
                aria-hidden="true"
                data-handle={handle}
                {...edit.dragProps(selectedSource, handle)}
                className={cn(
                  "pointer-events-auto absolute size-2.5 touch-none rounded-chip border border-accent bg-surface before:absolute before:-inset-1.5 before:content-['']",
                  handleClasses[handle],
                  classNames?.handle,
                )}
              />
            ))}
            <button
              type="button"
              aria-label={strings.rotate}
              onClick={() => edit.rotate(selectedSource)}
              className={cn(
                "pointer-events-auto absolute right-0 bottom-full mb-1 inline-flex size-control-sm items-center justify-center rounded-control border border-line bg-surface text-ink-2 hover:bg-surface-2 focus-visible:focus-ring [&_svg]:size-4",
                classNames?.rotate,
              )}
            >
              <RotateCcw aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
