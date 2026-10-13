/** Groups conversations by recency for the sidebar list (port of the React kit's `groupByDate`). */

export type DateGroupId = "today" | "yesterday" | "week" | "month" | "older";

export const DATE_GROUP_LABELS: Record<DateGroupId, string> = {
  today: "Hoy",
  yesterday: "Ayer",
  week: "Últimos 7 días",
  month: "Últimos 30 días",
  older: "Anteriores",
};

const ORDER: DateGroupId[] = ["today", "yesterday", "week", "month", "older"];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function groupOf(date: Date | string | number, now: Date | string | number): DateGroupId {
  const days = Math.round((startOfDay(new Date(now)) - startOfDay(new Date(date))) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days <= 7) return "week";
  if (days <= 30) return "month";
  return "older";
}

export interface Dated {
  updatedAt: Date | string | number;
}

/** Newest first inside each group; empty groups are dropped; groups keep recency order. */
export function groupByDate<T extends Dated>(
  items: readonly T[],
  now: Date | string | number,
  labels: Partial<Record<DateGroupId, string>> = {},
): { id: DateGroupId; label: string; items: T[] }[] {
  const buckets = new Map<DateGroupId, T[]>();
  for (const item of items) {
    const id = groupOf(item.updatedAt, now);
    const bucket = buckets.get(id);
    if (bucket) bucket.push(item);
    else buckets.set(id, [item]);
  }
  return ORDER.flatMap((id) => {
    const list = buckets.get(id);
    if (!list) return [];
    const sorted = [...list].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    return [{ id, label: labels[id] ?? DATE_GROUP_LABELS[id], items: sorted }];
  });
}
