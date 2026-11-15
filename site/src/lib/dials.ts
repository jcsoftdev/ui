import {
  DIAL_KEYS,
  DIALS,
  PRESET_STORAGE_KEY,
  sanitizePreset,
  setDial,
  THEME_STORAGE_KEY,
} from "./preset-script.mjs";

export { DIAL_KEYS, DIALS, readDials } from "./preset-script.mjs";

export type DialKey = keyof typeof DIALS;
export type Theme = "light" | "dark";

/** Visible names for every dial position. Accent names are the token palette names. */
export const DIAL_LABELS: Record<DialKey, Record<string, string>> = {
  style: {
    soft: "Soft",
    bordered: "Bordered",
    elevated: "Elevated",
    flat: "Flat",
    glass: "Glass",
    brutal: "Brutal",
  },
  accent: {
    coral: "Coral",
    durazno: "Durazno",
    menta: "Menta",
    cielo: "Cielo",
    lavanda: "Lavanda",
    orquidea: "Orquídea",
    grafito: "Grafito",
  },
  density: {
    compact: "Compact",
    normal: "Normal",
    comfortable: "Roomy",
    touch: "Touch",
    auto: "Auto",
  },
  radius: {
    auto: "Default",
    none: "None",
    sm: "Small",
    md: "Medium",
    lg: "Large",
    full: "Full",
  },
  glass: { frosted: "Frosted", liquid: "Liquid", "liquid-clear": "Clear", "liquid-thick": "Thick" },
};

export const DIAL_NAMES: Record<DialKey, string> = {
  style: "Style",
  accent: "Accent",
  density: "Density",
  radius: "Radius",
  glass: "Glass",
};

export function dialOptions(key: DialKey) {
  return DIALS[key].values.map((value) => ({ value, label: DIAL_LABELS[key][value] ?? value }));
}

function storedPreset() {
  try {
    return sanitizePreset(JSON.parse(localStorage.getItem(PRESET_STORAGE_KEY) || "{}"));
  } catch {
    return {};
  }
}

/** Turns one dial on <html> and remembers it for the landing page and the docs alike. */
export function applyDial(key: DialKey, value: string) {
  const applied = setDial(document.documentElement, key, value);
  try {
    const next = { ...storedPreset(), [key]: applied };
    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(sanitizePreset(next)));
  } catch {
    /* storage blocked: the choice simply does not persist */
  }
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
}

/** Every dial back to its default position (theme is left alone). */
export function resetDials() {
  for (const key of DIAL_KEYS) delete document.documentElement.dataset[key];
  try {
    localStorage.removeItem(PRESET_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
