/** The zoomable partition behind the sunburst and the icicle: spans, the animated view and its target. */
import type { HierarchyNode } from "@jcsoftdev/ui-core/chart/hierarchy";
import {
  interpolateView,
  type PartitionSpan,
  type PartitionView,
  partitionLayout,
} from "@jcsoftdev/ui-core/chart/partition";
import { HierarchyChart, type HierarchyModel } from "./hierarchy-base.js";

const viewOf = (spans: Map<string, PartitionSpan>, node: HierarchyNode): PartitionView => {
  const span = spans.get(node.id) ?? { x0: 0, x1: 1 };
  return { x0: span.x0, x1: span.x1, depth: node.depth };
};
export const sameView = (a: PartitionView, b: PartitionView): boolean =>
  a.x0 === b.x0 && a.x1 === b.x1 && a.depth === b.depth;

export abstract class PartitionChart extends HierarchyChart {
  #spans: { root: HierarchyNode; map: Map<string, PartitionSpan> } | undefined;
  #view: PartitionView | undefined;
  #target: PartitionView | undefined;

  #spansOf(root: HierarchyNode): Map<string, PartitionSpan> {
    if (this.#spans?.root !== root) this.#spans = { root, map: partitionLayout(root) };
    return this.#spans.map;
  }

  /** The spans, the view being drawn now, and the view the zoom is going to. */
  protected partition(model: HierarchyModel): {
    spans: Map<string, PartitionSpan>;
    view: PartitionView;
    target: PartitionView;
  } {
    const spans = this.#spansOf(model.root);
    const target = viewOf(spans, model.focus);
    // A focus the zoom did not ask for (new data, `focus-id`) jumps.
    if (!this.#view || !this.#target || !sameView(this.#target, target)) {
      this.#view = target;
      this.#target = target;
    }
    return { spans, view: this.#view, target };
  }

  protected override onZoom(_from: HierarchyNode, to: HierarchyNode): void {
    const target = viewOf(this.#spansOf(this.model().root), to);
    const start = { ...(this.#view ?? target) };
    this.#target = target;
    this.play((t) => {
      this.#view = interpolateView(start, target, t);
    });
  }
}
