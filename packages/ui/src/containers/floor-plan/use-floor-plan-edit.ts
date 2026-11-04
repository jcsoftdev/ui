import { type PointerEvent, type RefObject, useRef, useState } from "react";
import {
  type EditBounds,
  editKey,
  moveBox,
  type ResizeHandle,
  resizeBox,
  sameBox,
} from "./edit-model.js";
import type { Box, FloorPlanBox } from "./model.js";

type DragMode = "move" | ResizeHandle;

interface Drag {
  id: string;
  mode: DragMode;
  startX: number;
  startY: number;
  origin: Box;
  unit: number;
  moved: boolean;
}

const DRAG_THRESHOLD_PX = 3;

function capturePointer(element: HTMLElement, pointerId: number): boolean {
  try {
    element.setPointerCapture(pointerId);
    return true;
  } catch {
    return false;
  }
}

const pick = ({ x, y, width, height }: Box): Box => ({ x, y, width, height });

interface Options<I extends FloorPlanBox, L extends FloorPlanBox> {
  enabled: boolean;
  items: readonly I[];
  landmarks: readonly L[];
  bounds: EditBounds;
  canvasRef: RefObject<HTMLElement | null>;
  onChange?: ((items: I[], landmarks: L[]) => void) | undefined;
  onSelect?: ((id: string) => void) | undefined;
}

/** Drag, resize, rotate and keyboard edits of floor plan boxes; commits only on release, never mid-drag. */
export function useFloorPlanEdit<I extends FloorPlanBox, L extends FloorPlanBox>({
  enabled,
  items,
  landmarks,
  bounds,
  canvasRef,
  onChange,
  onSelect,
}: Options<I, L>) {
  const [draft, setDraft] = useState<{ id: string; box: Box } | null>(null);
  const drag = useRef<Drag | null>(null);

  const view = <T extends FloorPlanBox>(entry: T): T =>
    draft?.id === entry.id ? { ...entry, ...draft.box } : entry;

  const commit = (id: string, box: Box) => {
    const current = [...items, ...landmarks].find((entry) => entry.id === id);
    if (!current || sameBox(pick(current), box)) return;
    const apply = <T extends FloorPlanBox>(list: readonly T[]): T[] =>
      list.map((entry) => (entry.id === id ? { ...entry, ...box } : entry));
    onChange?.(apply(items), apply(landmarks));
  };

  const dragProps = (entry: FloorPlanBox, mode: DragMode) => ({
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (!enabled || event.button !== 0) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      event.stopPropagation();
      capturePointer(event.currentTarget, event.pointerId);
      drag.current = {
        id: entry.id,
        mode,
        startX: event.clientX,
        startY: event.clientY,
        origin: pick(entry),
        unit: canvas.getBoundingClientRect().width / bounds.width,
        moved: false,
      };
      onSelect?.(entry.id);
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      const current = drag.current;
      if (!current || current.id !== entry.id) return;
      const px = Math.hypot(event.clientX - current.startX, event.clientY - current.startY);
      if (!current.moved && px < DRAG_THRESHOLD_PX) return;
      current.moved = true;
      const dx = (event.clientX - current.startX) / current.unit;
      const dy = (event.clientY - current.startY) / current.unit;
      const box =
        current.mode === "move"
          ? moveBox(current.origin, dx, dy, bounds)
          : resizeBox(current.origin, current.mode, dx, dy, bounds);
      setDraft((previous) =>
        previous && sameBox(previous.box, box) ? previous : { id: entry.id, box },
      );
    },
    onPointerUp: (event: PointerEvent<HTMLElement>) => {
      const current = drag.current;
      if (!current || current.id !== entry.id) return;
      drag.current = null;
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      if (current.moved && draft) commit(entry.id, draft.box);
      setDraft(null);
    },
    onPointerCancel: () => {
      drag.current = null;
      setDraft(null);
    },
  });

  const onKeyDown = (entry: FloorPlanBox) => (event: React.KeyboardEvent<HTMLElement>) => {
    if (!enabled) return;
    const result = editKey(pick(entry), event, bounds);
    if (!result) return;
    event.preventDefault();
    commit(entry.id, result.box);
  };

  const rotate = (entry: FloorPlanBox) => {
    const result = editKey(pick(entry), { key: "r", altKey: false, shiftKey: false }, bounds);
    if (result) commit(entry.id, result.box);
  };

  return { view, dragProps, onKeyDown, rotate };
}
