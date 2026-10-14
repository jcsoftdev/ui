/**
 * Keeps a floating overlay glued to its anchor while the page moves under it. A tooltip lives in
 * the top layer in viewport coordinates, so scrolling the page or any scroll container, or pinching
 * the visual viewport, would leave it behind. Loaded by the tooltip the first time it floats.
 *
 * `place()` runs at most once per frame after any scroll (in the capture phase, so every scroll
 * container counts), window resize, or visual viewport scroll or resize. `hide(true)` is called when
 * the anchor leaves the viewport, or is scrolled out of an ancestor that clips it, and `hide(false)`
 * when it comes back. Returns the stop function.
 */
export function follow(
  anchor: Element,
  place: () => void,
  hide: (hidden: boolean) => void,
): () => void {
  let frame = 0;
  const schedule = () => {
    frame ||= requestAnimationFrame(() => {
      frame = 0;
      place();
    });
  };
  const watcher = new IntersectionObserver((entries) => {
    const entry = entries.at(-1);
    if (entry) hide(!entry.isIntersecting);
  });
  watcher.observe(anchor);
  const viewport = window.visualViewport;
  addEventListener("scroll", schedule, { capture: true, passive: true });
  addEventListener("resize", schedule, { passive: true });
  viewport?.addEventListener("scroll", schedule);
  viewport?.addEventListener("resize", schedule);
  return () => {
    cancelAnimationFrame(frame);
    watcher.disconnect();
    removeEventListener("scroll", schedule, { capture: true });
    removeEventListener("resize", schedule);
    viewport?.removeEventListener("scroll", schedule);
    viewport?.removeEventListener("resize", schedule);
  };
}
