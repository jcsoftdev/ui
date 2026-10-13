/** Calls `callback` with the content rect whenever `element` resizes (and once on start). */
export function observeResize(
  element: Element,
  callback: (rect: DOMRectReadOnly) => void,
): () => void {
  if (typeof ResizeObserver === "undefined") return () => {};
  const observer = new ResizeObserver((entries) => {
    const entry = entries[entries.length - 1];
    if (entry) callback(entry.contentRect);
  });
  observer.observe(element);
  return () => observer.disconnect();
}
