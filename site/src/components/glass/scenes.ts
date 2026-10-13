/** Backdrops for the glass demos: three CC0 photos (sources kept in public/photos/CREDITS.md) and a gradient. */
export interface Scene {
  id: string;
  label: string;
  /** Short description for assistive technology; the photos are decoration behind the glass. */
  alt: string;
  kind: "photo" | "gradient";
  /** Prefix of the files in /photos: `<file>-<width>.avif|webp`. */
  file?: string;
  width?: number;
  height?: number;
}

export const SCENES: Scene[] = [
  {
    id: "wilderness",
    label: "Wilderness",
    alt: "A hiker on a rock above green, misty hills",
    kind: "photo",
    file: "wilderness",
    width: 1920,
    height: 1275,
  },
  {
    id: "bridge",
    label: "Golden Gate",
    alt: "Aerial view of the Golden Gate Bridge over teal water",
    kind: "photo",
    file: "bridge",
    width: 1920,
    height: 1222,
  },
  {
    id: "alley",
    label: "Alley",
    alt: "A person at the end of an arched alley in Yazd",
    kind: "photo",
    file: "alley",
    width: 1920,
    height: 1280,
  },
  { id: "gradient", label: "Gradient", alt: "A colourful gradient", kind: "gradient" },
];

export const sceneById = (id: string) => SCENES.find((s) => s.id === id) ?? (SCENES[0] as Scene);
