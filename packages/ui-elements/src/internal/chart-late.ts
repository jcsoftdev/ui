// Loaded only by a chart that has `initial-hidden` or `initialHidden`.
type Host = {
  chartSnapshot: { legend?: readonly { id: string }[]; series?: readonly { id: string }[] } | null;
};

/** Seeds the hidden set from the property, else from the attribute: a JSON array of ids. */
export function seed(
  element: HTMLElement & { initialHidden?: readonly string[] },
  hidden: Set<string>,
): void {
  let ids: unknown = element.initialHidden;
  try {
    ids ??= JSON.parse(element.getAttribute("initial-hidden") ?? "");
  } catch {}
  if (Array.isArray(ids)) for (const id of ids) hidden.add(`${id}`);
}

/** After the first draw: when the seed hid every series, shows the last one again. True when it changed. */
export function settle(element: Host, hidden: Set<string>): boolean {
  const snapshot = element.chartSnapshot;
  const ids = (snapshot?.legend ?? snapshot?.series ?? []).map((item) => item.id);
  if (!ids.length || ids.some((id) => !hidden.has(id))) return false;
  hidden.delete(ids[ids.length - 1] as string);
  return true;
}
