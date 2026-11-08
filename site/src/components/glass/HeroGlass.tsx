import { Button } from "@jcsoftdev/ui/atoms";
import { Card } from "@jcsoftdev/ui/containers";
import { LIQUID_PRESETS, LiquidGlass, liquidStyle } from "@jcsoftdev/ui/liquid";
import { CompactDials } from "../landing/PresetSwitcher";
import { Photo } from "./Photo";
import { sceneById } from "./scenes";

const install = "pnpm add @jcsoftdev/ui react react-dom";
const photo = sceneById("wilderness");
const card = liquidStyle({ ...LIQUID_PRESETS.regular, radius: 32 });

/** The hero: a real photo, a liquid-glass card with the pitch, and the dial panel that restyles the whole page. */
export default function HeroGlass({ components, charts }: { components: number; charts: number }) {
  return (
    <div className="hero-stage" id="hero">
      <LiquidGlass />
      <Photo scene={photo} priority sizes="100vw" className="scene-media" />
      <div className="hero-scrim" aria-hidden="true" />
      <div className="landing-wrap hero-grid">
        <Card material="liquid" style={card} className="hero-card">
          <p className="landing-kicker">
            <span className="pole w-10" aria-hidden="true" /> React, Tailwind and Compose
          </p>
          <h1 className="landing-h1 hero-title">Turn a dial. The whole kit changes.</h1>
          <p className="landing-lead hero-lead">
            {components} accessible React components and {charts} chart types that restyle from
            attributes on <code>&lt;html&gt;</code>: style, accent, density, radius, glass and
            theme. Liquid Glass is one position of the dial. Zero runtime dependencies on the web, a
            Compose Multiplatform twin on mobile.
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
          <CompactDials />
        </div>
      </div>
    </div>
  );
}
