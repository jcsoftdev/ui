"use client";

import { useEffect, useRef, useState } from "react";
import { easeOutCubic, useReducedMotion } from "../core/motion.js";
import type { TreeLayout, TreeLayoutNode } from "../core/tree-layout.js";

/** A laid-out node as drawn in the current frame. */
export interface TreePose extends TreeLayoutNode {
  opacity: number;
}

interface Track {
  node: TreeLayoutNode;
  from: { x: number; y: number; opacity: number };
  to: { x: number; y: number; opacity: number };
}

function settled(layout: TreeLayout): TreePose[] {
  return layout.nodes.map((node) => ({ ...node, opacity: 1 }));
}

/**
 * Moves the drawn nodes from the previous layout to the next one with
 * `requestAnimationFrame`: nodes that stay glide to their new place, nodes that
 * appear grow out of their closest visible ancestor, and nodes that disappear
 * fold back into it. Jumps straight to the new layout when disabled, under
 * `prefers-reduced-motion`, or on the server.
 */
export function useTreeTransition(
  layout: TreeLayout,
  parentOf: (id: string) => string | null,
  { disabled = false, duration = 360 }: { disabled?: boolean; duration?: number } = {},
): TreePose[] {
  const reduced = useReducedMotion();
  const [poses, setPoses] = useState<TreePose[]>(() => settled(layout));
  const current = useRef(poses);
  const parents = useRef(parentOf);
  parents.current = parentOf;

  useEffect(() => {
    const final = settled(layout);
    const previous = current.current;
    const show = (next: TreePose[]) => {
      current.current = next;
      setPoses(next);
    };
    if (disabled || reduced || typeof requestAnimationFrame !== "function") {
      show(final);
      return;
    }
    const from = new Map(previous.map((pose) => [pose.id, pose]));
    const target = new Map(layout.nodes.map((node) => [node.id, node]));
    const nearest = <T>(id: string, among: Map<string, T>): T | undefined => {
      for (let parent = parents.current(id); parent; parent = parents.current(parent)) {
        const hit = among.get(parent);
        if (hit) return hit;
      }
      return undefined;
    };

    const tracks: Track[] = layout.nodes.map((node) => {
      const before = from.get(node.id);
      const origin = before ?? nearest(node.id, from);
      return {
        node,
        from: origin
          ? { x: origin.x, y: origin.y, opacity: before ? before.opacity : 0 }
          : { x: node.x, y: node.y, opacity: 0 },
        to: { x: node.x, y: node.y, opacity: 1 },
      };
    });
    for (const pose of previous) {
      if (target.has(pose.id)) continue;
      const into = nearest(pose.id, target);
      tracks.push({
        node: pose,
        from: { x: pose.x, y: pose.y, opacity: pose.opacity },
        to: { x: into?.x ?? pose.x, y: into?.y ?? pose.y, opacity: 0 },
      });
    }
    const moved = tracks.some(
      (track) =>
        track.from.x !== track.to.x ||
        track.from.y !== track.to.y ||
        track.from.opacity !== track.to.opacity,
    );
    if (!moved) {
      show(final);
      return;
    }

    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      if (t >= 1) {
        show(final);
        return;
      }
      const e = easeOutCubic(t);
      show(
        tracks.map(({ node, from: a, to: b }) => ({
          ...node,
          x: a.x + (b.x - a.x) * e,
          y: a.y + (b.y - a.y) * e,
          opacity: a.opacity + (b.opacity - a.opacity) * e,
        })),
      );
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [layout, disabled, reduced, duration]);

  return poses;
}
