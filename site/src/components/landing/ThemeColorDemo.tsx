import { Button, Chip, Progress, Switch } from "@jcsoftdev/ui/atoms";
import { type CSSProperties, useId, useState } from "react";

/** Contrast colour (white or near-black) for text on `hex`. */
function onColor(hex: string) {
  const n = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.35 ? "#0b0b10" : "#ffffff";
}

/** The tokens are plain CSS variables, so a brand colour is four declarations on a scope. */
export default function ThemeColorDemo() {
  const id = useId();
  const [color, setColor] = useState("#2f6bff");
  const style = {
    "--accent": color,
    "--on-accent": onColor(color),
    "--accent-ink": `color-mix(in oklab, ${color} 70%, var(--ink))`,
    "--accent-soft": `color-mix(in oklab, ${color} 16%, transparent)`,
  } as CSSProperties;
  const css = `[data-brand] {\n  --accent: ${color};\n  --on-accent: ${onColor(color)};\n}`;
  return (
    <div className="theme-demo border-card shadow-card surface-card" style={style}>
      <div className="theme-demo__picker">
        <label htmlFor={id}>Brand colour</label>
        <input
          id={id}
          type="color"
          value={color}
          onChange={(e) => setColor(e.currentTarget.value)}
        />
        <output htmlFor={id}>{color}</output>
      </div>
      <div className="theme-demo__sample">
        <Button variant="primary">Book now</Button>
        <Chip tone="accent">Accent chip</Chip>
        <Switch defaultChecked aria-label="Sample switch" />
        <Progress value={64} aria-label="Sample progress" />
        <a href="/docs/theming/">A link in the accent ink</a>
      </div>
      <pre tabIndex={0}>
        <code>{css}</code>
      </pre>
    </div>
  );
}
