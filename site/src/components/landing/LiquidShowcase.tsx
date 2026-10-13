import { Button, Chip, Switch } from "@jcsoftdev/ui/atoms";
import { Card } from "@jcsoftdev/ui/containers";
import { LIQUID_PRESETS, LiquidGlass, liquidStyle } from "@jcsoftdev/ui/liquid";
import { useState } from "react";
import { Photo } from "../glass/Photo";
import { sceneById } from "../glass/scenes";

const scene = sceneById("bridge");
const thick = liquidStyle({ ...LIQUID_PRESETS.thick, radius: 36, interactive: "drag" });
const crystal = liquidStyle({ ...LIQUID_PRESETS.crystal, radius: 36, interactive: "drag" });

function Label({ children }: { children: string }) {
  return <span className="show-label">{children}</span>;
}

/** Three real lenses (budget: 8) over one photo, side by side with the frosted material. */
export default function LiquidShowcase() {
  const [notify, setNotify] = useState(true);
  return (
    <div className="show-stage">
      <LiquidGlass />
      <Photo scene={scene} sizes="(min-width: 1280px) 1200px, 100vw" />
      <div className="show-grid">
        <Card material="glass" className="show-card">
          <Chip tone="neutral">Frosted</Chip>
          <h3>Blur, tint and a hairline edge</h3>
          <p>The default glass: the legible, cross-browser look.</p>
        </Card>
        <Card material="liquid" className="show-card">
          <Chip tone="accent">Liquid</Chip>
          <h3>Lensing, rim light, thickness</h3>
          <p>Chromium bends the backdrop; every browser keeps the layered rim.</p>
          <label className="show-row">
            Reminders <Switch checked={notify} onCheckedChange={setNotify} aria-label="Reminders" />
          </label>
        </Card>
        <div className="show-pills">
          <div className="liquid-clear show-pill" style={thick}>
            <Label>Thick, draggable</Label>
          </div>
          <div className="liquid show-pill" style={crystal}>
            <Label>Crystal lens</Label>
          </div>
        </div>
      </div>
      <div className="show-cta">
        <Button asChild variant="primary">
          <a href="/playground/">Tune every option in the playground</a>
        </Button>
      </div>
    </div>
  );
}
