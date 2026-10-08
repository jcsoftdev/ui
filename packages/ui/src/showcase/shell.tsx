import { Moon, Sun } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { Switch } from "../atoms/switch/index.js";
import { AccentPicker } from "../forms/accent-picker/index.js";
import { Select } from "../forms/select/index.js";
import { Segmented, SegmentedItem } from "../navigation/segmented/index.js";
import { OverlayContainer } from "./bento.js";

const ACCENTS = [
  { value: "coral", label: "Coral", swatch: "var(--pal-coral-fill, #faa2a2)" },
  { value: "durazno", label: "Durazno", swatch: "var(--pal-durazno-fill)" },
  { value: "menta", label: "Menta", swatch: "var(--pal-menta-fill)" },
  { value: "cielo", label: "Cielo", swatch: "var(--pal-cielo-fill)" },
  { value: "lavanda", label: "Lavanda", swatch: "var(--pal-lavanda-fill)" },
  { value: "orquidea", label: "Orquídea", swatch: "var(--pal-orquidea-fill)" },
  { value: "grafito", label: "Grafito", swatch: "var(--pal-grafito-fill)" },
];

const STYLES = [
  { value: "", label: "Del toolbar" },
  { value: "soft", label: "Suave" },
  { value: "bordered", label: "Con bordes" },
  { value: "elevated", label: "Elevado" },
  { value: "flat", label: "Plano" },
  { value: "glass", label: "Vidrio" },
  { value: "brutal", label: "Brutal" },
];

/** Entrance animation; skipped entirely for people who ask for reduced motion. */
const CSS = `
@keyframes bento-in {
  from { opacity: 0; transform: translateY(14px) scale(0.985); }
  to { opacity: 1; transform: none; }
}
.bento-tile { animation: bento-in 520ms cubic-bezier(0.2, 0.7, 0.2, 1) both; animation-delay: calc(var(--bento-i, 0) * 45ms); }
@media (prefers-reduced-motion: reduce) { .bento-tile { animation: none; } }
`;

/**
 * Presets (style, density) go on the wrapper because they work on any element. Theme and accent
 * are only defined on `:root` by the tokens, so the controls set them on <html> and put the
 * previous values back when the story unmounts.
 */
function useRootAttribute(name: "theme" | "accent", value: string | undefined) {
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.dataset[name];
    if (value === undefined) return;
    if (name === "accent" && value === "coral") delete root.dataset.accent;
    else root.dataset[name] = value;
    return () => {
      if (previous === undefined) delete root.dataset[name];
      else root.dataset[name] = previous;
    };
  }, [name, value]);
}

export interface ShowcaseShellProps {
  /** Sticky bar with the local style, accent, density and dark controls. */
  controls?: boolean;
  title?: string;
  children: ReactNode;
}

export function ShowcaseShell({
  controls = true,
  title = "Galería",
  children,
}: ShowcaseShellProps) {
  const [style, setStyle] = useState("");
  const [density, setDensity] = useState("normal");
  const [accent, setAccent] = useState<string | undefined>(undefined);
  const [dark, setDark] = useState<boolean | undefined>(undefined);
  const [host, setHost] = useState<HTMLElement | null>(null);

  useRootAttribute("accent", accent);
  useRootAttribute("theme", dark === undefined ? undefined : dark ? "dark" : "light");

  const isDark =
    dark ?? (typeof document !== "undefined" && document.documentElement.dataset.theme === "dark");

  return (
    <OverlayContainer.Provider value={host}>
      <style>{CSS}</style>
      <div
        ref={setHost}
        data-style={style || undefined}
        data-density={density === "normal" ? undefined : density}
        className="@container/bento min-w-0 bg-bg text-ink"
        style={{ backgroundImage: "var(--page-backdrop)" }}
      >
        {controls ? (
          <div className="sticky top-0 z-20 -mx-px mb-density flex flex-wrap items-center gap-x-density-lg gap-y-density-sm rounded-card border-card px-card py-density-sm shadow-card surface-overlay">
            <strong className="text-card-title text-ink">{title}</strong>
            <div className="flex items-center gap-density-sm text-ink-2 text-meta">
              Estilo
              <Select
                aria-label="Estilo de datos"
                value={style}
                onChange={(event) => setStyle(event.target.value)}
                className="w-36"
              >
                {STYLES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <Segmented aria-label="Densidad" value={density} onValueChange={setDensity}>
              <SegmentedItem value="compact">Compacta</SegmentedItem>
              <SegmentedItem value="normal">Normal</SegmentedItem>
              <SegmentedItem value="comfortable">Cómoda</SegmentedItem>
            </Segmented>
            <AccentPicker
              aria-label="Color de acento"
              options={ACCENTS}
              value={accent ?? document.documentElement.dataset.accent ?? "coral"}
              onValueChange={setAccent}
            />
            <div className="ml-auto flex items-center gap-density-sm text-ink-2 text-meta">
              {isDark ? (
                <Moon aria-hidden="true" className="size-4" />
              ) : (
                <Sun aria-hidden="true" className="size-4" />
              )}
              Oscuro
              <Switch aria-label="Tema oscuro" checked={isDark} onCheckedChange={setDark} />
            </div>
          </div>
        ) : null}
        {children}
      </div>
    </OverlayContainer.Provider>
  );
}
