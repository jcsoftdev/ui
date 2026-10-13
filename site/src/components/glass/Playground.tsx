import { Button } from "@jcsoftdev/ui/atoms";
import { liquidStyle, supportsBackdropRefraction, useGlassLens } from "@jcsoftdev/ui/glass";
import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  applyPreset,
  cssSnippet,
  DEFAULT_PRESET,
  initialConfig,
  liveOptions,
  materialSnippet,
  PRESET_LABEL,
  PRESET_ORDER,
  type PlaygroundConfig,
  type PresetKey,
} from "./config";
import { Photo } from "./Photo";
import { SCENES, sceneById } from "./scenes";

type NumberKey = {
  [K in keyof PlaygroundConfig]: PlaygroundConfig[K] extends number ? K : never;
}[keyof PlaygroundConfig];

interface SliderSpec {
  key: NumberKey;
  label: string;
  min: number;
  max: number;
  step: number;
  /** Text for the value when it is not simply the number. */
  show?: (value: number) => string;
  hint?: string;
}

const px = (v: number) => `${v} px`;
const fixed = (digits: number) => (v: number) => v.toFixed(digits);

const GROUPS: { title: string; sliders: SliderSpec[] }[] = [
  {
    title: "Lens",
    sliders: [
      {
        key: "refraction",
        label: "Refraction",
        min: 0,
        max: 2,
        step: 0.01,
        show: fixed(2),
        hint: "0 to 2. Above 1 only the crystal profile bends further.",
      },
      {
        key: "bevelWidth",
        label: "Bevel width",
        min: 0,
        max: 120,
        step: 1,
        show: (v) => (v === 0 ? "auto" : px(v)),
        hint: "0 derives it from the size.",
      },
      { key: "dispersion", label: "Dispersion", min: 0, max: 0.2, step: 0.005, show: fixed(3) },
    ],
  },
  {
    title: "Material",
    sliders: [
      { key: "frost", label: "Frost (blur)", min: 0, max: 40, step: 0.1, show: (v) => px(v) },
      { key: "saturation", label: "Saturation", min: 0, max: 4, step: 0.05, show: fixed(2) },
      { key: "brightness", label: "Brightness", min: 0, max: 3, step: 0.05, show: fixed(2) },
      {
        key: "opacity",
        label: "Veil opacity",
        min: 0,
        max: 1,
        step: 0.01,
        show: fixed(2),
        hint: "0 is fully clear: no contrast guarantee.",
      },
    ],
  },
  {
    title: "Tint",
    sliders: [
      { key: "tintAmount", label: "Tint amount", min: 0, max: 1, step: 0.01, show: fixed(2) },
    ],
  },
  {
    title: "Edge and light",
    sliders: [
      { key: "rim", label: "Rim highlight", min: 0, max: 2, step: 0.01, show: fixed(2) },
      {
        key: "specularIntensity",
        label: "Specular intensity",
        min: 0,
        max: 2,
        step: 0.01,
        show: fixed(2),
      },
      {
        key: "specularAngle",
        label: "Specular angle",
        min: -180,
        max: 180,
        step: 1,
        show: (v) => `${v}°`,
      },
      { key: "fresnel", label: "Fresnel glow", min: 0, max: 1, step: 0.01, show: fixed(2) },
      { key: "grain", label: "Grain", min: 0, max: 1, step: 0.01, show: fixed(2) },
    ],
  },
  {
    title: "Shadow",
    sliders: [
      { key: "shadowOpacity", label: "Shadow opacity", min: 0, max: 2, step: 0.01, show: fixed(2) },
      { key: "shadowSpread", label: "Shadow spread", min: 0, max: 80, step: 1, show: (v) => px(v) },
      {
        key: "shadowOffsetY",
        label: "Shadow offset Y",
        min: -40,
        max: 80,
        step: 1,
        show: (v) => px(v),
      },
    ],
  },
  {
    title: "Shape",
    sliders: [
      { key: "radius", label: "Corner radius", min: 0, max: 80, step: 1, show: (v) => px(v) },
      { key: "width", label: "Width", min: 96, max: 520, step: 2, show: (v) => px(v) },
      { key: "height", label: "Height", min: 56, max: 320, step: 2, show: (v) => px(v) },
    ],
  },
];

const FIELD = "pg-field";

function Slider({
  spec,
  value,
  onChange,
}: {
  spec: SliderSpec;
  value: number;
  onChange: (value: number) => void;
}) {
  const id = useId();
  const text = spec.show ? spec.show(value) : String(value);
  return (
    <div className={FIELD}>
      <label htmlFor={id}>{spec.label}</label>
      <output htmlFor={id}>{text}</output>
      <input
        id={id}
        type="range"
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={value}
        aria-valuetext={text}
        aria-describedby={spec.hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
      />
      {spec.hint ? (
        <small id={`${id}-hint`} className="pg-hint">
          {spec.hint}
        </small>
      ) : null}
    </div>
  );
}

function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    <div className={FIELD}>
      <label htmlFor={id}>{label}</label>
      <output htmlFor={id}>{options.find((o) => o.value === value)?.label}</output>
      <select id={id} value={value} onChange={(e) => onChange(e.currentTarget.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

const STEP = 8;
const BIG_STEP = 40;
/** `translate` of the surface in px, as the lens motion has written it. */
function translateOf(el: HTMLElement) {
  const [x = "0", y = "0"] = getComputedStyle(el).translate.split(/\s+/);
  return { x: Number.parseFloat(x) || 0, y: Number.parseFloat(y) || 0 };
}

type Pos = { x: number; y: number };

function GlassPanel({
  config,
  stage,
  pos,
  setPos,
}: {
  config: PlaygroundConfig;
  stage: React.RefObject<HTMLDivElement | null>;
  pos: Pos | null;
  setPos: (pos: Pos | null) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const lensRef = useGlassLens<HTMLDivElement>(surfaceRef);
  const drag = useRef<{ gx: number; gy: number; id: number } | null>(null);
  const desired = useRef<Pos>({ x: 0, y: 0 });
  const frame = useRef(0);
  const [dragging, setDragging] = useState(false);

  const bounds = useCallback(() => {
    const s = stage.current;
    return {
      w: Math.max((s?.clientWidth ?? 0) - config.width, 0),
      h: Math.max((s?.clientHeight ?? 0) - config.height, 0),
    };
  }, [stage, config.width, config.height]);
  const clamp = useCallback(
    (p: Pos): Pos => {
      const b = bounds();
      return { x: Math.min(Math.max(p.x, 0), b.w), y: Math.min(Math.max(p.y, 0), b.h) };
    },
    [bounds],
  );
  const current = useCallback((): Pos => {
    const el = wrap.current;
    if (!el) return { x: 0, y: 0 };
    return { x: el.offsetLeft, y: el.offsetTop };
  }, []);

  // Keep the panel inside the stage when the stage or the panel is resized.
  useEffect(() => {
    const s = stage.current;
    if (!s || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (pos) setPos(clamp(pos));
    });
    observer.observe(s);
    return () => observer.disconnect();
  }, [stage, pos, clamp, setPos]);
  useEffect(() => {
    if (pos) setPos(clamp(pos));
  }, [config.width, config.height]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * The lens motion ("drag") rubber-bands the surface with `translate`. The panel follows the
   * pointer freely (left/top), so the loop below subtracts that `translate` from the position:
   * the surface sits exactly under the pointer, while the stretch and the jelly settle of the kit's
   * motion still play.
   */
  const loop = useCallback(() => {
    const el = wrap.current;
    const surface = surfaceRef.current;
    if (!el || !surface) return;
    const t = translateOf(surface);
    const target = desired.current;
    el.style.left = `${target.x - t.x}px`;
    el.style.top = `${target.y - t.y}px`;
    if (drag.current || Math.abs(t.x) > 0.3 || Math.abs(t.y) > 0.3) {
      frame.current = requestAnimationFrame(loop);
    } else {
      frame.current = 0;
      setPos({ x: target.x, y: target.y });
    }
  }, [setPos]);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button, a, input, select, textarea")) return;
    const el = wrap.current;
    if (!el) return;
    const start = current();
    desired.current = start;
    drag.current = { id: e.pointerId, gx: e.clientX - start.x, gy: e.clientY - start.y };
    // Absolute pixels from here on, whatever it was before.
    setDragging(true);
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(loop);
    const s = stage.current?.getBoundingClientRect();
    const grab = {
      x: e.clientX - (s?.left ?? 0) - start.x,
      y: e.clientY - (s?.top ?? 0) - start.y,
    };
    const move = (ev: PointerEvent) => {
      if (!drag.current || ev.pointerId !== drag.current.id) return;
      const rect = stage.current?.getBoundingClientRect();
      desired.current = clamp({
        x: ev.clientX - (rect?.left ?? 0) - grab.x,
        y: ev.clientY - (rect?.top ?? 0) - grab.y,
      });
    };
    const up = (ev: PointerEvent) => {
      if (!drag.current || ev.pointerId !== drag.current.id) return;
      drag.current = null;
      setDragging(false);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      if (!frame.current) frame.current = requestAnimationFrame(loop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? BIG_STEP : STEP;
    const at = pos ?? current();
    const move: Record<string, Pos> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    };
    if (e.key === "Home") {
      e.preventDefault();
      setPos(null);
      return;
    }
    const d = move[e.key];
    if (!d) return;
    e.preventDefault();
    setPos(clamp({ x: at.x + d.x, y: at.y + d.y }));
  };

  const options = useMemo(() => liveOptions(config), [config]);
  const surfaceStyle: CSSProperties = {
    ...liquidStyle(options),
    width: config.width,
    height: config.height,
    // Over a photo the glass is only a lens: the label keeps its own shadow instead of the halo.
    textShadow: config.label === "light" ? "0 2px 10px rgb(0 0 0 / 0.5)" : "none",
    color: config.label === "light" ? "#fff" : "var(--ink)",
  };
  const place: CSSProperties = pos
    ? { left: pos.x, top: pos.y }
    : {
        left: `calc(50% - ${config.width / 2}px)`,
        top: `calc(50% - ${config.height / 2}px)`,
      };

  return (
    <div
      ref={wrap}
      className="pg-panel"
      data-dragging={dragging || undefined}
      style={{ ...place, width: config.width, height: config.height, touchAction: "none" }}
      tabIndex={0}
      role="group"
      aria-roledescription="movable panel"
      aria-label="Glass panel. Drag it, or use the arrow keys to move it; Shift moves further, Home centres it."
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    >
      <div
        ref={lensRef}
        className={`${config.type} pg-surface`}
        style={surfaceStyle}
        data-testid="glass-surface"
      >
        {config.label === "none" ? null : <span className="pg-label">Liquid Glass</span>}
      </div>
    </div>
  );
}

const INTERACTIVE = [
  { value: "none", label: "None" },
  { value: "press", label: "Press" },
  { value: "drag", label: "Drag (elastic)" },
] as const;
const MOTION = [
  { value: "snappy", label: "Snappy" },
  { value: "smooth", label: "Smooth" },
  { value: "soft", label: "Soft" },
  { value: "jelly", label: "Jelly" },
  { value: "off", label: "Off" },
] as const;
const PROFILE = [
  { value: "crystal", label: "Crystal (minify)" },
  { value: "full", label: "Full (pillow)" },
  { value: "dome", label: "Dome" },
  { value: "rim", label: "Rim only" },
] as const;
const LABEL = [
  { value: "light", label: "White, shadowed" },
  { value: "ink", label: "Ink colour" },
  { value: "none", label: "No label" },
] as const;

function useSupport() {
  const [state, setState] = useState<"checking" | "lens" | "fallback" | "reduced">("checking");
  useEffect(() => {
    const off = [
      "(prefers-reduced-transparency: reduce)",
      "(prefers-contrast: more)",
      "(forced-colors: active)",
      "(prefers-reduced-motion: reduce)",
    ];
    const check = () => {
      if (off.some((q) => matchMedia(q).matches)) return setState("reduced");
      setState(supportsBackdropRefraction() ? "lens" : "fallback");
    };
    check();
    const lists = off.map((q) => matchMedia(q));
    for (const l of lists) l.addEventListener("change", check);
    return () => {
      for (const l of lists) l.removeEventListener("change", check);
    };
  }, []);
  return state;
}

export default function Playground() {
  const [config, setConfig] = useState<PlaygroundConfig>(initialConfig);
  const [preset, setPreset] = useState<PresetKey | "custom">(DEFAULT_PRESET);
  const [sceneId, setSceneId] = useState("wilderness");
  const [pos, setPos] = useState<Pos | null>(null);
  const [copied, setCopied] = useState("");
  const stage = useRef<HTMLDivElement>(null);
  const support = useSupport();
  const scene = sceneById(sceneId);

  const set = <K extends keyof PlaygroundConfig>(key: K, value: PlaygroundConfig[K]) => {
    setConfig((c) => ({ ...c, [key]: value }));
    setPreset("custom");
  };
  const choosePreset = (name: PresetKey) => {
    setConfig((c) => applyPreset(c, name));
    setPreset(name);
  };
  const reset = () => {
    setConfig(initialConfig());
    setPreset(DEFAULT_PRESET);
    setPos(null);
    setSceneId("wilderness");
  };
  // The type and the pointer mode are surface choices, not part of a preset.
  const setSurface = <K extends "type" | "interactive" | "motion" | "label">(
    key: K,
    value: PlaygroundConfig[K],
  ) => setConfig((c) => ({ ...c, [key]: value }));

  const material = materialSnippet(config);
  const css = cssSnippet(config);
  const copy = async (what: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(`${what} copied`);
    } catch {
      setCopied("Select the text and press Ctrl+C");
    }
    setTimeout(() => setCopied(""), 2000);
  };

  const tintId = useId();

  return (
    <div className="pg">
      <div className="pg-stage-col">
        <div
          ref={stage}
          className="pg-stage"
          data-scene={scene.id}
          role="region"
          aria-label="Preview: a glass panel over a backdrop"
        >
          <Photo scene={scene} priority sizes="(min-width: 1024px) 60vw, 100vw" />
          <GlassPanel config={config} stage={stage} pos={pos} setPos={setPos} />
        </div>
        <div className="pg-below">
          <fieldset className="pg-scenes">
            <legend>Backdrop</legend>
            {SCENES.map((s) => (
              <label key={s.id} className="pg-scene" data-active={s.id === sceneId || undefined}>
                <input
                  type="radio"
                  name="scene"
                  value={s.id}
                  checked={s.id === sceneId}
                  onChange={() => setSceneId(s.id)}
                />
                <span className={`pg-thumb pg-thumb--${s.id}`} aria-hidden="true">
                  {s.kind === "photo" ? (
                    <img
                      src={`/photos/${s.file}-640.webp`}
                      alt=""
                      loading="lazy"
                      width="96"
                      height="64"
                    />
                  ) : null}
                </span>
                <span>{s.label}</span>
              </label>
            ))}
          </fieldset>
          <p className="pg-credit">
            {scene.credit ? (
              <>
                Photo:{" "}
                <a href={scene.credit.url} rel="noopener">
                  {scene.credit.title}
                </a>{" "}
                by {scene.credit.author} (@{scene.credit.handle}), CC0 1.0. Other backdrops are
                credited in <a href="/photos/CREDITS.md">CREDITS</a>.
              </>
            ) : (
              <>
                A generated gradient. The photos are CC0, credited in{" "}
                <a href="/photos/CREDITS.md">CREDITS</a>.
              </>
            )}
          </p>
          <p className="pg-status" role="status" data-state={support}>
            {support === "lens" &&
              "Lens active: this browser renders the refraction. Drag the panel, or focus it and use the arrow keys."}
            {support === "fallback" &&
              "This browser cannot render the lens (it needs Chromium: Chrome, Edge, Brave, Arc). You see the fallback: rim, depth and shadow without refraction, so the crystal and the lens sliders have no visible effect."}
            {support === "reduced" &&
              "Your system asks for reduced motion, transparency or more contrast, so the lens is off and the glass is the plain fallback."}
            {support === "checking" && "Checking lens support…"}
          </p>
        </div>
      </div>

      <form
        className="pg-controls"
        aria-label="Liquid Glass options"
        onSubmit={(e) => e.preventDefault()}
      >
        <div className="pg-actions">
          <Button
            type="button"
            variant="primary"
            onClick={() => copy("Config", `${material}\n\n${css}`)}
          >
            Copy config
          </Button>
          <Button type="button" variant="secondary" onClick={reset}>
            Reset
          </Button>
          <span className="pg-copied" role="status">
            {copied}
          </span>
        </div>

        <fieldset className="pg-group">
          <legend>Preset</legend>
          <div className="pg-presets" role="group" aria-label="Preset">
            {PRESET_ORDER.map((name) => (
              <button
                key={name}
                type="button"
                className="pg-chip"
                aria-pressed={preset === name}
                onClick={() => choosePreset(name)}
              >
                {PRESET_LABEL[name]}
              </button>
            ))}
            <span className="pg-chip pg-chip--custom" data-on={preset === "custom" || undefined}>
              Custom
            </span>
          </div>
          <Select
            label="Variant"
            value={config.type}
            options={[
              { value: "liquid", label: "liquid (regular)" },
              { value: "liquid-clear", label: "liquid-clear" },
            ]}
            onChange={(v) => setSurface("type", v)}
          />
          <Select
            label="Profile"
            value={config.profile}
            options={[...PROFILE]}
            onChange={(v) => set("profile", v)}
          />
        </fieldset>

        {GROUPS.map((group) => (
          <fieldset className="pg-group" key={group.title}>
            <legend>{group.title}</legend>
            {group.sliders.map((spec) => (
              <Slider
                key={spec.key}
                spec={spec}
                value={config[spec.key]}
                onChange={(v) => set(spec.key, v)}
              />
            ))}
            {group.title === "Tint" ? (
              <div className={FIELD}>
                <label htmlFor={tintId}>Tint colour</label>
                <output htmlFor={tintId}>{config.tintColor}</output>
                <input
                  id={tintId}
                  type="color"
                  value={config.tintColor}
                  onChange={(e) => set("tintColor", e.currentTarget.value)}
                />
              </div>
            ) : null}
          </fieldset>
        ))}

        <fieldset className="pg-group">
          <legend>Motion and label</legend>
          <Select
            label="Interactive"
            value={config.interactive}
            options={[...INTERACTIVE]}
            onChange={(v) => setSurface("interactive", v)}
          />
          <Select
            label="Motion"
            value={config.motion}
            options={[...MOTION]}
            onChange={(v) => setSurface("motion", v)}
          />
          <Select
            label="Label"
            value={config.label}
            options={[...LABEL]}
            onChange={(v) => setSurface("label", v)}
          />
        </fieldset>

        <section className="pg-output" aria-label="Generated code">
          <div className="pg-output__head">
            <h2>material prop</h2>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => copy("Material", material)}
            >
              Copy
            </Button>
          </div>
          <pre tabIndex={0}>
            <code>{material}</code>
          </pre>
          <div className="pg-output__head">
            <h2>CSS variables</h2>
            <Button type="button" size="sm" variant="secondary" onClick={() => copy("CSS", css)}>
              Copy
            </Button>
          </div>
          <pre tabIndex={0}>
            <code>{css}</code>
          </pre>
        </section>
      </form>
    </div>
  );
}
