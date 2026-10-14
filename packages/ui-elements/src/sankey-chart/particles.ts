// The moving dots of `particles` on the sankey chart, loaded the first time they are asked for.
// Each dot rides its link's path with the Web Animations API, so a dimmed link can pause its dots.
import { type SankeyLink, sankeyLinkPath } from "@jcsoftdev/ui-core/chart/sankey";
import { svg } from "../internal/chart-base.js";

export interface Particles {
  layer: SVGGElement;
  /** Pauses (and hides) the dots of every link not in `lit`; `null` lets them all run. */
  dim(lit: ReadonlySet<string> | null): void;
}

const FRAMES = [
  { offsetDistance: "0%", opacity: 0 },
  { opacity: 1, offset: 0.12 },
  { opacity: 1, offset: 0.88 },
  { offsetDistance: "100%", opacity: 0 },
];

/** `bandWidth(link)` is the width in px the dots travel along. */
export function particles(
  links: readonly SankeyLink[],
  bandWidth: (link: SankeyLink) => number,
): Particles {
  const layer = svg("g", { "aria-hidden": "true", "data-export-skip": "", "data-particles": "" });
  const dots: Array<{ id: string; el: SVGCircleElement; run: Animation }> = [];
  for (const link of links) {
    const band = bandWidth(link);
    if (band < 3) continue;
    const path = sankeyLinkPath(link);
    const length = Math.hypot(link.target.x0 - link.source.x1, link.y1 - link.y0) * 1.1;
    const duration = Math.min(14, Math.max(3.5, length / 42)) * 1000;
    const count = Math.min(5, Math.max(1, Math.round(band / 6)));
    for (let i = 0; i < count; i += 1) {
      const el = svg("circle", {
        r: Math.min(2.6, Math.max(1.3, band * 0.16)),
        "data-link-id": link.id,
        style: `fill:var(--surface);fill-opacity:.92;offset-path:path("${path}");offset-rotate:0deg`,
      });
      layer.append(el);
      const run = el.animate(FRAMES, {
        duration,
        delay: -(i / count) * duration,
        iterations: Number.POSITIVE_INFINITY,
        fill: "both",
      });
      dots.push({ id: link.id, el, run });
    }
  }
  return {
    layer,
    dim(lit) {
      for (const { id, el, run } of dots) {
        const dimmed = lit !== null && !lit.has(id);
        el.toggleAttribute("data-dim", dimmed);
        if (dimmed) run.pause();
        else run.play();
      }
    },
  };
}
