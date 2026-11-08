// The Dial Set: every look switch the site exposes, shared by the landing page and the docs (Starlight `head`).
// Each dial is one `data-*` attribute on <html>. The default position removes the attribute, so the
// token defaults apply. Theme is the fifth dial and lives in Starlight's own `starlight-theme` key.
export const PRESET_STORAGE_KEY = "ui-site:preset";
export const THEME_STORAGE_KEY = "starlight-theme";

/**
 * Values are the ones `@jcsoftdev/ui-tokens` styles (tokens.css, base.css). `default` is the token default and is
 * never written as an attribute.
 * @type {Record<"style" | "accent" | "density" | "radius" | "glass", { default: string, values: readonly string[] }>}
 */
export const DIALS = {
  style: { default: "soft", values: ["soft", "bordered", "elevated", "flat", "glass", "brutal"] },
  accent: {
    default: "coral",
    values: ["coral", "durazno", "menta", "cielo", "lavanda", "orquidea", "grafito"],
  },
  density: { default: "normal", values: ["compact", "normal", "comfortable", "touch", "auto"] },
  radius: { default: "auto", values: ["auto", "none", "sm", "md", "lg", "full"] },
  glass: { default: "frosted", values: ["frosted", "liquid", "liquid-clear", "liquid-thick"] },
};

/** @typedef {keyof typeof DIALS} DialKey */
/** @type {DialKey[]} */
export const DIAL_KEYS = /** @type {DialKey[]} */ (Object.keys(DIALS));

/**
 * Keeps only known dials set to a known, non-default value. Older stored presets (`{ style, accent, density,
 * radius }`, with "" for defaults) pass through unchanged apart from dropping the empty entries.
 * @param {unknown} raw
 * @returns {Partial<Record<DialKey, string>>}
 */
export function sanitizePreset(raw) {
  /** @type {Partial<Record<DialKey, string>>} */
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const key of DIAL_KEYS) {
    const value = /** @type {Record<string, unknown>} */ (raw)[key];
    const dial = DIALS[key];
    if (typeof value === "string" && value !== dial.default && dial.values.includes(value))
      out[key] = value;
  }
  return out;
}

/**
 * Sets one dial on an element (the default or an unknown value removes the attribute).
 * @param {{ dataset: Record<string, string | undefined> }} root
 * @param {DialKey} key
 * @param {string} value
 * @returns {string} the value now in effect
 */
export function setDial(root, key, value) {
  const dial = DIALS[key];
  if (value === dial.default || !dial.values.includes(value)) {
    delete root.dataset[key];
    return dial.default;
  }
  root.dataset[key] = value;
  return value;
}

/**
 * The current position of every dial, defaults filled in.
 * @param {{ dataset: Record<string, string | undefined> }} root
 * @returns {Record<DialKey, string>}
 */
export function readDials(root) {
  return /** @type {Record<DialKey, string>} */ (
    Object.fromEntries(DIAL_KEYS.map((key) => [key, root.dataset[key] || DIALS[key].default]))
  );
}

const allowed = Object.fromEntries(
  DIAL_KEYS.map((key) => [key, DIALS[key].values.filter((v) => v !== DIALS[key].default)]),
);

// Inline <head> script: restores the look before first paint so there is no flash. Storage can be blocked,
// so everything is wrapped in try/catch; stored values outside the dial set are ignored.
export const presetInitScript = `(function(){try{
var d=document.documentElement;
var t=localStorage.getItem("${THEME_STORAGE_KEY}");
if(t!=="dark"&&t!=="light"){t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"}
d.dataset.theme=t;
var p=JSON.parse(localStorage.getItem("${PRESET_STORAGE_KEY}")||"{}")||{};
var a=${JSON.stringify(allowed)};
for(var k in a){if(typeof p[k]==="string"&&a[k].indexOf(p[k])>=0)d.dataset[k]=p[k]}
}catch(e){}})();`;
