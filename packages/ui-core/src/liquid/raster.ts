/**
 * Rasterises a displacement or light field to a PNG `data:` URI for `feImage` (browser only). A
 * small cache shared by every map keeps reopening a surface of the same size free.
 */
import type { DisplacementField } from "./lens-map.js";

const cache = new Map<string, string>();
const CACHE_SIZE = 16;

export function cached(key: string, compute: () => DisplacementField): string {
  const hit = cache.get(key);
  if (hit) return hit;
  const field = compute();
  const canvas = document.createElement("canvas");
  canvas.width = field.width;
  canvas.height = field.height;
  const context = canvas.getContext("2d");
  if (!context) return "";
  const image = context.createImageData(field.width, field.height);
  image.data.set(field.data);
  context.putImageData(image, 0, 0);
  const uri = canvas.toDataURL("image/png");
  cache.set(key, uri);
  if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value as string);
  return uri;
}
