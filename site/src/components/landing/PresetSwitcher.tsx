import { Button, Switch } from "@jcsoftdev/ui/atoms";
import { AccentPicker, NativeSelect } from "@jcsoftdev/ui/forms";
import { Segmented, SegmentedItem } from "@jcsoftdev/ui/navigation";
import { Moon, RotateCcw, Sun } from "@jcsoftdev/ui/icons";
import { useEffect, useId, useState, useSyncExternalStore } from "react";
import {
  applyDial,
  applyTheme,
  DIAL_KEYS,
  DIALS,
  dialOptions,
  type DialKey,
  resetDials,
} from "../../lib/dials";

export { applyTheme };

const ATTRS = [...DIAL_KEYS.map((key) => `data-${key}`), "data-theme"];

const subscribe = (notify: () => void) => {
  const observer = new MutationObserver(notify);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ATTRS });
  return () => observer.disconnect();
};
const snapshot = () => ATTRS.map((a) => document.documentElement.getAttribute(a) ?? "").join("|");
const serverSnapshot = () => ATTRS.map(() => "").join("|");

/** Reads the look from the <html> attributes, so any number of islands stay in sync without a shared context. */
export function usePreset() {
  const raw = useSyncExternalStore(subscribe, snapshot, serverSnapshot).split("|");
  const dials = Object.fromEntries(
    DIAL_KEYS.map((key, i) => [key, raw[i] || DIALS[key].default]),
  ) as Record<DialKey, string>;
  return { ...dials, theme: raw[DIAL_KEYS.length] || "dark" };
}

/** Like `usePreset`, but reports the defaults until hydration so the first client render matches the server. */
function useHydratedPreset() {
  const preset = usePreset();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (ready) return preset;
  return {
    ...(Object.fromEntries(DIAL_KEYS.map((key) => [key, DIALS[key].default])) as Record<
      DialKey,
      string
    >),
    theme: "dark",
  };
}

export const applyPreset = applyDial;
export const resetPreset = resetDials;

export const STYLES = DIALS.style.values;

export const ACCENTS = dialOptions("accent").map(({ value, label }) => ({
  value,
  label,
  swatch: value === "coral" ? "var(--pal-coral-fill, #faa2a2)" : `var(--pal-${value}-fill)`,
}));

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-ink-3 text-meta font-semibold tracking-wide">{label}</span>
      {children}
    </div>
  );
}

function DialSegmented({ dial, value }: { dial: Exclude<DialKey, "accent">; value: string }) {
  return (
    <Segmented
      aria-label={dial === "style" ? "Style preset" : dial[0]!.toUpperCase() + dial.slice(1)}
      value={value}
      onValueChange={(v) => v && applyDial(dial, v)}
      className="flex-wrap"
    >
      {dialOptions(dial).map((o) => (
        <SegmentedItem key={o.value} value={o.value}>
          {o.label}
        </SegmentedItem>
      ))}
    </Segmented>
  );
}

function DialSelect({ dial, value, label }: { dial: DialKey; value: string; label: string }) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-ink-3 text-meta font-semibold">
        {label}
      </label>
      <NativeSelect
        id={id}
        size="sm"
        value={value}
        options={dialOptions(dial)}
        onChange={(e) => applyDial(dial, e.currentTarget.value)}
      />
    </div>
  );
}

function ThemeSwitch({ theme }: { theme: string }) {
  const dark = theme === "dark";
  return (
    <label className="flex min-h-8 items-center gap-density-sm text-ink-2 text-meta">
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

function Readout({ p }: { p: Record<DialKey | "theme", string> }) {
  const attrs = (["style", "accent", "theme", "density", "radius", "glass"] as const).map(
    (key) => `data-${key}="${p[key]}"`,
  );
  return (
    <pre
      className="m-0 overflow-x-auto rounded-control bg-surface-sunken px-3 py-2 text-[12px] leading-relaxed text-ink-2"
      aria-label="Current attributes"
    >
      <code>{`<html ${attrs.slice(0, 3).join(" ")}\n      ${attrs.slice(3).join(" ")}>`}</code>
    </pre>
  );
}

/** Full control panel: every dial plus the attribute readout. Only sets data-* attributes on <html>. */
export default function PresetSwitcher() {
  const p = useHydratedPreset();
  return (
    <section
      aria-label="Look and feel dials"
      className="landing-glow flex flex-col gap-density rounded-card border-card p-card shadow-raised surface-overlay"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="m-0 text-card-title text-ink">Every dial</h2>
          <p className="m-0 text-ink-3 text-meta">Six attributes. The whole page restyles.</p>
        </div>
        <Button size="sm" variant="ghost" onClick={resetDials} aria-label="Reset every dial">
          <RotateCcw aria-hidden /> Reset
        </Button>
      </div>
      <Row label="data-style">
        <DialSegmented dial="style" value={p.style} />
      </Row>
      <div className="grid gap-density sm:grid-cols-2">
        <Row label="data-accent">
          <AccentPicker
            aria-label="Accent palette"
            options={ACCENTS}
            value={p.accent}
            onValueChange={(v) => applyDial("accent", v)}
          />
        </Row>
        <Row label="data-theme">
          <ThemeSwitch theme={p.theme} />
        </Row>
      </div>
      <Row label="data-density">
        <DialSegmented dial="density" value={p.density} />
      </Row>
      <Row label="data-radius">
        <DialSegmented dial="radius" value={p.radius} />
      </Row>
      <Row label="data-glass">
        <DialSegmented dial="glass" value={p.glass} />
        <span className="text-ink-3 text-meta">
          Turns glass surfaces liquid; in the Glass style that includes menus, dialogs and bars.
        </span>
      </Row>
      <Readout p={p} />
    </section>
  );
}

/** The hero version: the same dials, with the secondary ones as selects so the panel stays short. */
export function CompactDials() {
  const p = useHydratedPreset();
  return (
    <section
      aria-label="Look and feel dials"
      className="hero-dials flex w-full flex-col gap-density rounded-card border-card p-card shadow-raised surface-overlay text-ink"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="m-0 text-card-title text-ink">Turn a dial</h2>
        <a
          href="#theming"
          className="inline-flex min-h-6 items-center text-meta font-semibold text-accent-ink"
        >
          All dials and the markup
        </a>
      </div>
      <Row label="Style">
        <DialSegmented dial="style" value={p.style} />
      </Row>
      <Row label="Accent">
        <AccentPicker
          aria-label="Accent palette"
          options={ACCENTS}
          value={p.accent}
          onValueChange={(v) => applyDial("accent", v)}
        />
      </Row>
      <div className="grid grid-cols-2 gap-density sm:grid-cols-3">
        <DialSelect dial="density" value={p.density} label="Density" />
        <DialSelect dial="radius" value={p.radius} label="Radius" />
        <DialSelect dial="glass" value={p.glass} label="Glass" />
      </div>
      <div className="flex items-center justify-between gap-2">
        <ThemeSwitch theme={p.theme} />
        <Button size="sm" variant="ghost" onClick={resetDials} aria-label="Reset every dial">
          <RotateCcw aria-hidden /> Reset
        </Button>
      </div>
    </section>
  );
}
