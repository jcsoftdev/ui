import { globalSingleton } from "./global-singleton.js";

/** Ordered stack of open overlay layers; only the topmost reacts to Escape and outside presses. */
export interface LayerStack<T extends object = object> {
  push(layer: T): () => void;
  isTop(layer: T): boolean;
  size(): number;
}

export function createLayerStack<T extends object = object>(): LayerStack<T> {
  const layers: T[] = [];
  return {
    push(layer) {
      layers.push(layer);
      return () => {
        const index = layers.indexOf(layer);
        if (index !== -1) layers.splice(index, 1);
      };
    },
    isTop: (layer) => layers[layers.length - 1] === layer,
    size: () => layers.length,
  };
}

export const overlayLayers = globalSingleton("@jcsoftdev/ui/overlay-layers", () =>
  createLayerStack(),
);
