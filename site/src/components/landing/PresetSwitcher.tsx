import { Button } from "@jcsoftdev/ui/atoms";
import { Switch } from "@jcsoftdev/ui/atoms";
import { AccentPicker } from "@jcsoftdev/ui/forms";
import { Segmented, SegmentedItem } from "@jcsoftdev/ui/navigation";
import { Moon, RotateCcw, Sun } from "@jcsoftdev/ui/icons";
import { useEffect, useState, useSyncExternalStore } from "react";
import { PRESET_STORAGE_KEY, THEME_STORAGE_KEY } from "../../lib/preset-script.mjs";

type Key = "style" | "accent" | "density" | "radius";

const ATTRS = ["data-style", "data-accent", "data-theme", "data-density", "data-radius"];

const subscribe = (notify: () => void) => {
  const observer = new MutationObserver(notify);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ATTRS });
  return () => observer.disconnect();
};
const snapshot = () => ATTRS.map((a) => document.documentElement.getAttribute(a) ?? "").join("|");

/** Reads the look from the <html> attributes, so any number of islands stay in sync without a shared context. */
export function usePreset() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "||||");
  const [style, accent, theme, density, radius] = raw.split("|");
  return {
    style: style || "soft",
    accent: accent || "coral",
    theme: theme || "dark",
    density: density || "normal",
    radius: radius || "auto",
  };
}

function persist(patch: Partial<Record<Key, string>>) {
  try {
    const previous = JSON.parse(localStorage.getItem(PRESET_STORAGE_KEY) || "{}");
    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify({ ...previous, ...patch }));
  } catch {
    /* storage blocked: the choice simply does not persist */
  }
}

export function applyPreset(key: Key, value: string) {
  const root = document.documentElement;
  const isDefault =
    (key === "accent" && value === "coral") ||
    (key === "radius" && value === "auto") ||
    (key === "density" && value === "normal") ||
    (key === "style" && value === "soft");
  if (isDefault) delete root.dataset[key];
  else root.dataset[key] = value;
  persist({ [key]: isDefault ? "" : value });
}

export function applyTheme(theme: "light" | "dark") {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
}

export function resetPreset() {
  for (const key of ["style", "accent", "density", "radius"] as const)
    delete document.documentElement.dataset[key];
  try {
    localStorage.removeItem(PRESET_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export const STYLES = ["soft", "bordered", "elevated", "flat", "glass", "brutal"] as const;
const STYLE_LABELS: Record<(typeof STYLES)[number], string> = {
  soft: "Soft",
  bordered: "Bordered",
  elevated: "Elevated",
  flat: "Flat",
  glass: "Glass",
  brutal: "Brutal",
};

export const ACCENTS = [
  { value: "coral", label: "Coral", swatch: "var(--pal-coral-fill, #faa2a2)" },
  { value: "durazno", label: "Durazno", swatch: "var(--pal-durazno-fill)" },
  { value: "menta", label: "Menta", swatch: "var(--pal-menta-fill)" },
  { value: "cielo", label: "Cielo", swatch: "var(--pal-cielo-fill)" },
  { value: "lavanda", label: "Lavanda", swatch: "var(--pal-lavanda-fill)" },
  { value: "orquidea", label: "Orquídea", swatch: "var(--pal-orquidea-fill)" },
  { value: "grafito", label: "Grafito", swatch: "var(--pal-grafito-fill)" },
];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-ink-3 text-meta font-semibold uppercase tracking-wider">{label}</span>
      {children}
    </div>
  );
}

function ThemeSwitch() {
  const { theme } = usePreset();
  const dark = theme === "dark";
  return (
    <label className="flex items-center gap-density-sm text-ink-2 text-meta">
      {dark ? <Moon aria-hidden className="size-4" /> : <Sun aria-hidden className="size-4" />}
      <span>{dark ? "Dark" : "Light"}</span>
      <Switch
        aria-label="Dark theme"
        checked={dark}
        onCheckedChange={(on) => applyTheme(on ? "dark" : "light")}
      />
    </label>
  );
}

/** Full control panel for the hero. Only sets data-* attributes on <html>; nothing else re-renders. */
export default function PresetSwitcher() {
  const p = usePreset();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return (
    <section
      aria-label="Live look and feel"
      className="landing-glow flex flex-col gap-density rounded-card border-card p-card shadow-raised surface-overlay"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="m-0 text-card-title text-ink">Try the look</h2>
          <p className="m-0 text-ink-3 text-meta">Five attributes. The whole page restyles.</p>
        </div>
        <Button size="sm" variant="ghost" onClick={resetPreset} aria-label="Reset the look">
          <RotateCcw aria-hidden /> Reset
        </Button>
      </div>
      <Row label="data-style">
        <Segmented
          aria-label="Style preset"
          value={ready ? p.style : "soft"}
          onValueChange={(v) => v && applyPreset("style", v)}
          className="flex-wrap"
        >
          {STYLES.map((s) => (
            <SegmentedItem key={s} value={s}>
              {STYLE_LABELS[s]}
            </SegmentedItem>
          ))}
        </Segmented>
      </Row>
      <div className="grid gap-density sm:grid-cols-2">
        <Row label="data-accent">
          <AccentPicker
            aria-label="Accent palette"
            options={ACCENTS}
            value={ready ? p.accent : "coral"}
            onValueChange={(v) => applyPreset("accent", v)}
          />
        </Row>
        <Row label="data-theme">
          <ThemeSwitch />
        </Row>
        <Row label="data-density">
          <Segmented
            aria-label="Density"
            value={ready ? p.density : "normal"}
            onValueChange={(v) => v && applyPreset("density", v)}
          >
            <SegmentedItem value="compact">Compact</SegmentedItem>
            <SegmentedItem value="normal">Normal</SegmentedItem>
            <SegmentedItem value="comfortable">Roomy</SegmentedItem>
          </Segmented>
        </Row>
        <Row label="data-radius">
          <Segmented
            aria-label="Radius"
            value={ready ? p.radius : "auto"}
            onValueChange={(v) => v && applyPreset("radius", v)}
          >
            <SegmentedItem value="auto">Auto</SegmentedItem>
            <SegmentedItem value="none">0</SegmentedItem>
            <SegmentedItem value="md">M</SegmentedItem>
            <SegmentedItem value="full">Full</SegmentedItem>
          </Segmented>
        </Row>
      </div>
      <pre
        className="m-0 overflow-x-auto rounded-control bg-surface-sunken px-3 py-2 text-[12px] leading-relaxed text-ink-2"
        aria-label="Current attributes"
      >
        <code>{`<html data-style="${ready ? p.style : "soft"}" data-accent="${ready ? p.accent : "coral"}"\n      data-theme="${ready ? p.theme : "dark"}" data-density="${ready ? p.density : "normal"}">`}</code>
      </pre>
    </section>
  );
}
