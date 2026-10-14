/**
 * - `start`: opening balance, an absolute bar from 0 that sets the running total.
 * - `delta`: an increase (positive) or a decrease (negative) applied to the running total.
 * - `subtotal`: a bar from 0 to the running total so far (its `value` is ignored).
 * - `total`: the same as a subtotal, drawn as the closing bar.
 */
export type WaterfallStepType = "start" | "delta" | "subtotal" | "total";

export interface WaterfallStep {
  id?: string;
  label: string;
  value?: number;
  /** Defaults to "delta". */
  type?: WaterfallStepType;
}

export type WaterfallKind = "increase" | "decrease" | "start" | "subtotal" | "total";

export interface WaterfallBar {
  index: number;
  id: string;
  label: string;
  kind: WaterfallKind;
  /** Delta for increases and decreases, absolute amount for start, subtotal and total. */
  value: number;
  /** Where the bar begins on the value axis. */
  from: number;
  /** Where the bar ends; also the running total after this step. */
  to: number;
}

export interface WaterfallLayout {
  bars: WaterfallBar[];
  /** Lowest and highest value any bar reaches, always including 0. */
  min: number;
  max: number;
  /** Running total after the last step. */
  final: number;
}

/** Running totals for a list of steps. Missing values count as 0. */
export function waterfallLayout(steps: ReadonlyArray<WaterfallStep>): WaterfallLayout {
  let running = 0;
  let min = 0;
  let max = 0;
  const bars = steps.map((step, index): WaterfallBar => {
    const type = step.type ?? "delta";
    const value = Number.isFinite(step.value) ? (step.value as number) : 0;
    let kind: WaterfallKind;
    let from: number;
    let to: number;
    let shown = value;
    if (type === "start") {
      kind = "start";
      from = 0;
      to = value;
    } else if (type === "subtotal" || type === "total") {
      kind = type;
      from = 0;
      to = running;
      shown = running;
    } else {
      kind = value >= 0 ? "increase" : "decrease";
      from = running;
      to = running + value;
    }
    running = to;
    min = Math.min(min, from, to);
    max = Math.max(max, from, to);
    return {
      index,
      id: step.id ?? `${index}-${step.label}`,
      label: step.label,
      kind,
      value: shown,
      from,
      to,
    };
  });
  return { bars, min, max, final: running };
}

export interface WaterfallLabelBox {
  /** Horizontal centre of the label. */
  center: number;
  width: number;
  /** Baseline of the label. */
  y: number;
}

/**
 * Which labels to draw: left to right, a label is kept unless it overlaps an
 * already kept one horizontally while sitting less than `lineHeight` away
 * vertically. Labels wider than their bar still show whenever the neighbours
 * are far enough above or below, or the gap between them is wide enough.
 */
export function pickLabels(
  boxes: readonly WaterfallLabelBox[],
  gap = 4,
  lineHeight = 13,
): boolean[] {
  const kept: WaterfallLabelBox[] = [];
  // Boxes arrive left to right, so only the kept labels within reach of this one can clash: scan back
  // from the last kept label until the horizontal gap alone rules the rest out (linear overall).
  // Unordered input keeps the full scan.
  let ordered = true;
  for (let i = 1; i < boxes.length && ordered; i += 1)
    ordered = (boxes[i] as WaterfallLabelBox).center >= (boxes[i - 1] as WaterfallLabelBox).center;
  let widest = 0;
  return boxes.map((box) => {
    let clash = false;
    for (let k = kept.length - 1; k >= 0; k -= 1) {
      const other = kept[k] as WaterfallLabelBox;
      const reach = (other.width + box.width) / 2 + gap;
      if (ordered && box.center - other.center >= (widest + box.width) / 2 + gap) break;
      if (Math.abs(other.center - box.center) < reach && Math.abs(other.y - box.y) < lineHeight) {
        clash = true;
        break;
      }
    }
    if (!clash) {
      kept.push(box);
      if (box.width > widest) widest = box.width;
    }
    return !clash;
  });
}
