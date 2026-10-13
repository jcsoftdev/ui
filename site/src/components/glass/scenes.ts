/** Backdrops for the glass demos: three CC0 photos (see public/photos/CREDITS.md) and a gradient. */
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
  credit?: { title: string; author: string; handle: string; url: string };
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
    credit: {
      title: "Alone in the unspoilt wilderness",
      author: "David Marcu",
      handle: "davidmarcu",
      url: "https://commons.wikimedia.org/wiki/File:Alone_in_the_unspoilt_wilderness_(Unsplash).jpg",
    },
  },
  {
    id: "bridge",
    label: "Golden Gate",
    alt: "Aerial view of the Golden Gate Bridge over teal water",
    kind: "photo",
    file: "bridge",
    width: 1920,
    height: 1222,
    credit: {
      title: "Golden Gate Bridge from above",
      author: "Chris Leipelt",
      handle: "cleipelt",
      url: "https://commons.wikimedia.org/wiki/File:(NOT_A)_Drone_view_of_golden_gate_bridge_(Unsplash).jpg",
    },
  },
  {
    id: "alley",
    label: "Alley",
    alt: "A person at the end of an arched alley in Yazd",
    kind: "photo",
    file: "alley",
    width: 1920,
    height: 1280,
    credit: {
      title: "Friendship alleys in Yazd, Iran",
      author: "Sander van Dijk",
      handle: "sandervd",
      url: "https://commons.wikimedia.org/wiki/File:%27Friendship_alleys%27_in_Yazd,_Iran._(Unsplash).jpg",
    },
  },
  { id: "gradient", label: "Gradient", alt: "A colourful gradient", kind: "gradient" },
];

export const sceneById = (id: string) => SCENES.find((s) => s.id === id) ?? (SCENES[0] as Scene);
