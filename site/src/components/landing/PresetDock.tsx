import { Segmented, SegmentedItem } from "@jcsoftdev/ui/navigation";
import { AccentPicker } from "@jcsoftdev/ui/forms";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { ACCENTS, applyPreset, applyTheme, STYLES, usePreset } from "./PresetSwitcher";

/** Compact floating bar that appears once the hero is out of view, so the look stays one click away. */
export default function PresetDock() {
  const p = usePreset();
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
    const hero = document.getElementById("hero");
    if (!hero || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(!entry?.isIntersecting), {
      threshold: 0,
    });
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  const dark = p.theme === "dark";
  return (
    <div
      data-visible={visible}
      className="landing-dock fixed inset-x-0 bottom-3 z-40 mx-auto flex w-fit max-w-[calc(100vw-1.5rem)] items-center gap-3 overflow-x-auto rounded-card border-card px-3 py-2 shadow-overlay surface-overlay"
      role="region"
      aria-label="Look and feel"
    >
      <Segmented
        aria-label="Style preset"
        value={ready ? p.style : "soft"}
        onValueChange={(v) => v && applyPreset("style", v)}
      >
        {STYLES.map((s) => (
          <SegmentedItem key={s} value={s}>
            {s}
          </SegmentedItem>
        ))}
      </Segmented>
      <AccentPicker
        aria-label="Accent palette"
        options={ACCENTS}
        value={ready ? p.accent : "coral"}
        onValueChange={(v) => applyPreset("accent", v)}
      />
      <button
        type="button"
        aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
        onClick={() => applyTheme(dark ? "light" : "dark")}
        className="inline-grid size-8 shrink-0 cursor-pointer place-items-center rounded-button text-ink-2 pressable hover:bg-surface-2 hover:text-ink focus-visible:focus-ring"
      >
        {dark ? <Moon aria-hidden className="size-4" /> : <Sun aria-hidden className="size-4" />}
      </button>
    </div>
  );
}
