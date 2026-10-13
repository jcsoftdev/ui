import { Button } from "@jcsoftdev/ui/atoms";
import { Card } from "@jcsoftdev/ui/containers";
import { LIQUID_PRESETS, liquidStyle, useGlassLens } from "@jcsoftdev/ui/glass";
import { Photo } from "./Photo";
import { sceneById } from "./scenes";

const install = "pnpm add @jcsoftdev/ui react react-dom";
const photo = sceneById("wilderness");
const crystal = liquidStyle({ ...LIQUID_PRESETS.crystal, radius: 40, interactive: "drag" });

interface Stat {
  value: number;
  label: string;
}

/** The hero: a real photo, a liquid-glass card with the pitch, and a crystal pill that can be dragged and springs back. */
export default function HeroGlass({ components, charts }: { components: number; charts: number }) {
  const pill = useGlassLens<HTMLDivElement>();
  const stats: Stat[] = [
    { value: components, label: "web components" },
    { value: charts, label: "chart types" },
  ];
  return (
    <div className="hero-stage" id="hero">
      <Photo scene={photo} priority sizes="100vw" className="scene-media" />
      <div className="hero-scrim" aria-hidden="true" />
      <div className="landing-wrap hero-grid">
        <Card material={{ type: "liquid", preset: "regular", radius: 32 }} className="hero-card">
          <p className="landing-kicker">
            <span className="pole w-10" aria-hidden="true" /> React, Tailwind and Compose
          </p>
          <h1 className="landing-h1 hero-title">Liquid Glass, and everything around it.</h1>
          <p className="landing-lead hero-lead">
            A token-driven design system with {components} accessible components, {charts} chart
            types, six style presets and real Liquid Glass lensing. Zero runtime dependencies on the
            web, a Compose Multiplatform twin on mobile.
          </p>
          <div className="hero-actions">
            <a
              href="/docs/getting-started/"
              className="inline-flex h-11 items-center rounded-button bg-accent px-5 font-semibold text-on-accent no-underline pressable hover:brightness-110 focus-visible:focus-ring"
            >
              Get started
            </a>
            <a
              href="/playground/"
              className="inline-flex h-11 items-center rounded-button border-card px-5 font-semibold text-ink no-underline surface-card pressable hover:surface-2 focus-visible:focus-ring"
            >
              Open the playground
            </a>
          </div>
          <div className="hero-install">
            <code>{install}</code>
            <Button type="button" size="sm" variant="secondary" data-copy={install}>
              Copy
            </Button>
          </div>
        </Card>
        <div className="hero-side">
          <div ref={pill} className="liquid hero-pill" style={crystal} data-testid="hero-pill">
            <span>Drag me</span>
          </div>
          <ul className="hero-stats" role="list">
            {stats.map((s) => (
              <li key={s.label}>
                <strong>{s.value}</strong> {s.label}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="hero-credit">
        Photo: David Marcu, CC0 · <a href="/photos/CREDITS.md">credits</a>
      </p>
    </div>
  );
}
