export type OrderTicketState = "ok" | "warn" | "late";

export type OrderTicketLineStatus = "pending" | "in-progress" | "done";

export interface OrderTicketLine {
  id: string;
  qty: number;
  name: string;
  modifiers?: readonly string[] | undefined;
  note?: string | undefined;
  allergy?: string | undefined;
  status?: OrderTicketLineStatus | undefined;
  onToggle?: (() => void) | undefined;
}

const MIN_WARN_LEAD_SECONDS = 120;
const WARN_LEAD_SHARE = 0.25;

export function warnLeadSeconds(targetMinutes: number): number {
  return Math.max(MIN_WARN_LEAD_SECONDS, targetMinutes * 60 * WARN_LEAD_SHARE);
}

export function orderTicketState(elapsedSeconds: number, targetMinutes: number): OrderTicketState {
  const target = targetMinutes * 60;
  if (elapsedSeconds > target) return "late";
  if (elapsedSeconds >= target - warnLeadSeconds(targetMinutes)) return "warn";
  return "ok";
}

type LineShape = Pick<OrderTicketLine, "modifiers" | "note" | "allergy">;

export function ticketLineCost(line: LineShape): number {
  return 1 + (line.modifiers?.length ? 0.6 : 0) + (line.note ? 0.9 : 0) + (line.allergy ? 0.9 : 0);
}

export function splitTicketLines<Line extends LineShape>(
  lines: readonly Line[],
  budget: number,
  cost: (line: Line) => number = ticketLineCost,
): Line[][] {
  const parts: Line[][] = [];
  let used = 0;
  for (const line of lines) {
    const weight = cost(line);
    const current = parts.at(-1);
    if (current && used + weight <= budget) {
      current.push(line);
      used += weight;
    } else {
      parts.push([line]);
      used = weight;
    }
  }
  return parts;
}
