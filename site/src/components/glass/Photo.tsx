import type { Scene } from "./scenes";

const WIDTHS = [640, 1280, 1920] as const;
const set = (file: string, ext: string) =>
  WIDTHS.map((w) => `/photos/${file}-${w}.${ext} ${w}w`).join(", ");

interface PhotoProps {
  scene: Scene;
  /** `sizes` of the image: the stage is usually as wide as the column it sits in. */
  sizes?: string;
  priority?: boolean;
  className?: string;
}

/** A responsive photo (AVIF, then WebP, 640 / 1280 / 1920 px wide) that covers its positioned parent. */
export function Photo({ scene, sizes = "100vw", priority = false, className }: PhotoProps) {
  if (scene.kind !== "photo" || !scene.file) return <GradientScene className={className} />;
  return (
    <picture>
      <source type="image/avif" srcSet={set(scene.file, "avif")} sizes={sizes} />
      <source type="image/webp" srcSet={set(scene.file, "webp")} sizes={sizes} />
      <img
        src={`/photos/${scene.file}-1280.webp`}
        alt=""
        width={scene.width}
        height={scene.height}
        decoding="async"
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        className={className ?? "scene-media"}
        draggable={false}
      />
    </picture>
  );
}

/** Colour, bold shapes and big type, so the lens has edges and text to bend. */
export function GradientScene({ className }: { className?: string }) {
  return (
    <div className={`scene-gradient ${className ?? "scene-media"}`} aria-hidden="true">
      <span className="scene-gradient__word">LIQUID GLASS BENDS LIGHT</span>
      <span className="scene-gradient__dot scene-gradient__dot--a" />
      <span className="scene-gradient__dot scene-gradient__dot--b" />
      <span className="scene-gradient__dot scene-gradient__dot--c" />
    </div>
  );
}
