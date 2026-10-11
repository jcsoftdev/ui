"use client";

import { type ReactNode, useId, useMemo, useState } from "react";
import { Button } from "../atoms/button/button.js";
import { Input } from "../forms/input/input.js";
import { cn } from "../utils/cn.js";
import { copyText, downloadBlob, fileSlug, svgBlob, svgToPngBlob } from "./export.js";
import {
  generateMark,
  generateVariations,
  MARK_SHAPES,
  type MarkFill,
  type MarkLayout,
  type MarkMonogram,
  type MarkOptions,
  type MarkShape,
  serializeMark,
} from "./generate.js";
import { GLYPHS, type GlyphId } from "./glyphs.js";
import { LogoMark } from "./logo-mark.js";
import { BRAND_PALETTES, type BrandPalette } from "./palettes.js";

type Background = "none" | "light" | "dark";

export interface LogoForgeValue {
  name: string;
  tagline: string;
  shape: MarkShape;
  monogram: MarkMonogram;
  glyph: GlyphId;
  initialsCount: 1 | 2 | 3;
  layout: MarkLayout;
  fill: MarkFill;
  /** A palette id or "custom" (uses `custom`). */
  paletteId: string;
  custom: { primary: string; secondary: string; ink: string };
  ring: boolean | undefined;
  seed: number;
  weight: 400 | 600 | 700 | 800;
  tracking: number;
  uppercase: boolean;
  background: Background;
}

export const DEFAULT_FORGE_VALUE: LogoForgeValue = {
  name: "Barbería Don Lucho",
  tagline: "Corte y navaja desde 1998",
  shape: "shield",
  monogram: "glyph",
  glyph: "scissors",
  initialsCount: 2,
  layout: "horizontal",
  fill: "solid",
  paletteId: "navaja",
  custom: { primary: "#2f6f5e", secondary: "#e3b04b", ink: "#10211c" },
  ring: false,
  seed: 0,
  weight: 700,
  tracking: 0.06,
  uppercase: true,
  background: "none",
};

const SHAPE_LABELS: Record<MarkShape, string> = {
  circle: "Círculo",
  squircle: "Squircle",
  shield: "Escudo",
  hexagon: "Hexágono",
  badge: "Insignia",
  ribbon: "Cinta",
  none: "Sin forma",
};

const LAYOUT_LABELS: Record<MarkLayout, string> = {
  icon: "Solo ícono",
  horizontal: "Horizontal",
  stacked: "Vertical",
};

const FILL_LABELS: Record<MarkFill, string> = {
  solid: "Sólido",
  gradient: "Degradado",
  outline: "Contorno",
};

const BACKGROUND_LABELS: Record<Background, string> = {
  none: "Transparente",
  light: "Claro",
  dark: "Oscuro",
};

const WEIGHTS: { value: LogoForgeValue["weight"]; label: string }[] = [
  { value: 400, label: "Normal" },
  { value: 600, label: "Medio" },
  { value: 700, label: "Negrita" },
  { value: 800, label: "Extra" },
];

function paletteOf(value: LogoForgeValue): BrandPalette | string {
  return value.paletteId === "custom"
    ? { id: "custom", label: "Personalizada", ...value.custom }
    : value.paletteId;
}

/** Turns the editor state into generator options. */
export function forgeOptions(value: LogoForgeValue): MarkOptions {
  return {
    name: value.name,
    tagline: value.tagline,
    shape: value.shape,
    monogram: value.monogram,
    glyph: value.glyph,
    initialsCount: value.initialsCount,
    layout: value.layout,
    fill: value.fill,
    palette: paletteOf(value),
    seed: value.seed,
    ring: value.ring,
    wordmark: { weight: value.weight, tracking: value.tracking, uppercase: value.uppercase },
    background:
      value.background === "light"
        ? "#ffffff"
        : value.background === "dark"
          ? "#16161b"
          : undefined,
    wordmarkColor: value.background === "dark" ? "#f4f4f6" : undefined,
  };
}

function Field({
  label,
  group,
  children,
}: {
  label: string;
  group?: boolean;
  children: ReactNode;
}) {
  if (group) {
    return (
      <fieldset className="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0">
        <legend className="mb-1.5 p-0 font-semibold text-ink-2 text-meta">{label}</legend>
        {children}
      </fieldset>
    );
  }
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="font-semibold text-ink-2 text-meta">{label}</span>
      {children}
    </div>
  );
}

const choiceBase =
  "inline-flex h-control-sm cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-chip px-3 font-semibold text-fs-125 pressable focus-visible:focus-ring";

function choiceClass(on: boolean) {
  return cn(
    choiceBase,
    on ? "bg-accent text-on-accent" : "bg-surface-control text-ink-2 shadow-control hover:text-ink",
  );
}

interface ChoiceProps<T extends string | number> {
  label: string;
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (value: T) => void;
}

function Choice<T extends string | number>({ label, value, options, onChange }: ChoiceProps<T>) {
  return (
    <Field group label={label}>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={option.value === value}
            className={choiceClass(option.value === value)}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </Field>
  );
}

export interface LogoForgeProps {
  defaultValue?: Partial<LogoForgeValue>;
  /** Called with the generator options each time the editor changes. */
  onChange?: (options: MarkOptions) => void;
  className?: string;
}

/**
 * Interactive brand-mark editor: pick a shape, monogram, palette and layout, browse twelve
 * seeded variations, then download SVG or PNG or copy the SVG source. The chrome follows
 * `data-style` and the active theme; the marks keep their own palettes.
 */
export function LogoForge({ defaultValue, onChange, className }: LogoForgeProps) {
  const id = useId();
  const [value, setValue] = useState<LogoForgeValue>({ ...DEFAULT_FORGE_VALUE, ...defaultValue });
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("");

  const options = useMemo(() => forgeOptions(value), [value]);
  const mark = useMemo(() => generateMark(options), [options]);
  const svg = useMemo(() => serializeMark(mark), [mark]);
  const variations = useMemo(() => generateVariations(options, 12, page), [options, page]);

  const update = (patch: Partial<LogoForgeValue>) => {
    const next = { ...value, ...patch };
    setValue(next);
    onChange?.(forgeOptions(next));
  };

  const pickVariation = (variant: MarkOptions) => {
    update({
      shape: variant.shape ?? value.shape,
      monogram: variant.monogram ?? value.monogram,
      glyph: variant.glyph ?? value.glyph,
      paletteId: typeof variant.palette === "string" ? variant.palette : value.paletteId,
      fill: variant.fill ?? value.fill,
      seed: variant.seed ?? 0,
      ring: undefined,
    });
  };

  const filename = fileSlug(value.name);
  const run = async (task: () => Promise<string> | string) => {
    try {
      setStatus(await task());
    } catch {
      setStatus("No se pudo completar la acción");
    }
  };

  const customPalette = value.paletteId === "custom";

  return (
    <section
      aria-label="Generador de logotipos"
      className={cn("@container/forge flex w-full min-w-0 flex-col gap-density-lg", className)}
    >
      <div className="grid min-w-0 gap-density-lg @3xl/forge:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="flex min-w-0 flex-col gap-density rounded-card border-card bg-surface-card p-card shadow-card">
          <div className="grid gap-density @md/forge:grid-cols-2">
            <Field label="Nombre">
              <Input
                id={`${id}-name`}
                aria-label="Nombre"
                value={value.name}
                maxLength={60}
                onChange={(e) => update({ name: e.target.value })}
              />
            </Field>
            <Field label="Eslogan">
              <Input
                id={`${id}-tagline`}
                aria-label="Eslogan"
                value={value.tagline}
                maxLength={80}
                onChange={(e) => update({ tagline: e.target.value })}
              />
            </Field>
          </div>
          <Choice
            label="Forma"
            value={value.shape}
            options={MARK_SHAPES.map((s) => ({ value: s, label: SHAPE_LABELS[s] }))}
            onChange={(shape) => update({ shape, seed: value.seed })}
          />
          <Choice
            label="Monograma"
            value={value.monogram}
            options={[
              { value: "initials", label: "Iniciales" },
              { value: "glyph", label: "Símbolo" },
            ]}
            onChange={(monogram) => update({ monogram })}
          />
          {value.monogram === "initials" ? (
            <Choice
              label="Letras"
              value={value.initialsCount}
              options={[1, 2, 3].map((n) => ({ value: n as 1 | 2 | 3, label: String(n) }))}
              onChange={(initialsCount) => update({ initialsCount })}
            />
          ) : (
            <Field group label="Símbolo">
              <div className="flex flex-wrap gap-1.5">
                {GLYPHS.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    aria-pressed={g.id === value.glyph}
                    aria-label={g.label}
                    title={g.label}
                    className={cn(choiceClass(g.id === value.glyph), "w-10 px-0")}
                    onClick={() => update({ glyph: g.id })}
                  >
                    <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true">
                      {g.parts.map((part) =>
                        part.kind === "fill" ? (
                          <path key={part.d} d={part.d} fill="currentColor" />
                        ) : (
                          <path
                            key={part.d}
                            d={part.d}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        ),
                      )}
                    </svg>
                  </button>
                ))}
              </div>
            </Field>
          )}
          <Choice
            label="Composición"
            value={value.layout}
            options={(Object.keys(LAYOUT_LABELS) as MarkLayout[]).map((l) => ({
              value: l,
              label: LAYOUT_LABELS[l],
            }))}
            onChange={(layout) => update({ layout })}
          />
          <Choice
            label="Relleno"
            value={value.fill}
            options={(Object.keys(FILL_LABELS) as MarkFill[]).map((f) => ({
              value: f,
              label: FILL_LABELS[f],
            }))}
            onChange={(fill) => update({ fill })}
          />
          <Field group label="Paleta">
            <div className="flex flex-wrap gap-1.5">
              {BRAND_PALETTES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={p.id === value.paletteId}
                  aria-label={p.label}
                  title={p.label}
                  onClick={() => update({ paletteId: p.id })}
                  className={cn(
                    "size-7 cursor-pointer rounded-full pressable focus-visible:focus-ring",
                    p.id === value.paletteId ? "shadow-selected" : "shadow-control",
                  )}
                  style={{
                    background: `linear-gradient(135deg, ${p.primary} 50%, ${p.secondary} 50%)`,
                  }}
                />
              ))}
              <button
                type="button"
                aria-pressed={customPalette}
                className={choiceClass(customPalette)}
                onClick={() => update({ paletteId: "custom" })}
              >
                Personalizada
              </button>
            </div>
          </Field>
          {customPalette ? (
            <div className="flex flex-wrap gap-density">
              {(["primary", "secondary", "ink"] as const).map((key) => (
                <label key={key} className="flex items-center gap-2 text-ink-2 text-meta">
                  <input
                    type="color"
                    value={value.custom[key]}
                    aria-label={
                      {
                        primary: "Color principal",
                        secondary: "Color secundario",
                        ink: "Color de texto",
                      }[key]
                    }
                    onChange={(e) => update({ custom: { ...value.custom, [key]: e.target.value } })}
                    className="size-7 cursor-pointer rounded-badge border-control bg-transparent p-0"
                  />
                  {{ primary: "Principal", secondary: "Secundario", ink: "Texto" }[key]}
                </label>
              ))}
            </div>
          ) : null}
          <Choice
            label="Peso del nombre"
            value={value.weight}
            options={WEIGHTS}
            onChange={(weight) => update({ weight })}
          />
          <div className="grid gap-density @md/forge:grid-cols-2">
            <Field label={`Espaciado (${value.tracking.toFixed(2)} em)`}>
              <input
                type="range"
                min={0}
                max={0.3}
                step={0.01}
                value={value.tracking}
                aria-label="Espaciado entre letras"
                onChange={(e) => update({ tracking: Number(e.target.value) })}
                className="h-control-sm w-full accent-(--accent-ink)"
              />
            </Field>
            <Field label="Opciones">
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  aria-pressed={value.uppercase}
                  className={choiceClass(value.uppercase)}
                  onClick={() => update({ uppercase: !value.uppercase })}
                >
                  Mayúsculas
                </button>
                <button
                  type="button"
                  aria-pressed={value.ring === true}
                  className={choiceClass(value.ring === true)}
                  onClick={() => update({ ring: value.ring !== true })}
                >
                  Anillo
                </button>
              </div>
            </Field>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-density">
          <div className="flex min-h-56 min-w-0 items-center justify-center rounded-card border-card bg-surface-sunken p-card shadow-card">
            <LogoMark {...options} size="min(100%, 420px)" />
          </div>
          <Choice
            label="Fondo de la vista previa"
            value={value.background}
            options={(Object.keys(BACKGROUND_LABELS) as Background[]).map((b) => ({
              value: b,
              label: BACKGROUND_LABELS[b],
            }))}
            onChange={(background) => update({ background })}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              onClick={() =>
                run(() => {
                  downloadBlob(svgBlob(svg), `${filename}.svg`);
                  return `${filename}.svg descargado`;
                })
              }
            >
              Descargar SVG
            </Button>
            <Button
              onClick={() =>
                run(async () => {
                  downloadBlob(
                    await svgToPngBlob(svg, mark.width, mark.height, 4),
                    `${filename}.png`,
                  );
                  return `${filename}.png descargado`;
                })
              }
            >
              Descargar PNG
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                run(async () => {
                  await copyText(svg);
                  return "SVG copiado al portapapeles";
                })
              }
            >
              Copiar SVG
            </Button>
            <span role="status" aria-live="polite" className="text-ink-3 text-meta">
              {status}
            </span>
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-density rounded-card border-card bg-surface-card p-card shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-card-title text-ink">Variaciones</h3>
          <Button size="sm" onClick={() => setPage((p) => p + 1)}>
            Mezclar
          </Button>
        </div>
        <ul className="grid min-w-0 grid-cols-2 gap-density @md/forge:grid-cols-3 @2xl/forge:grid-cols-4 @4xl/forge:grid-cols-6">
          {variations.map((variant) => (
            <li key={variant.seed} className="min-w-0">
              <button
                type="button"
                aria-label={`Usar variación ${variant.seed}`}
                aria-pressed={variant.seed === value.seed}
                onClick={() => pickVariation(variant)}
                className={cn(
                  "flex aspect-square w-full min-w-0 cursor-pointer items-center justify-center overflow-hidden rounded-card bg-surface-sunken p-3 pressable focus-visible:focus-ring",
                  variant.seed === value.seed ? "shadow-selected" : "shadow-control",
                )}
              >
                <LogoMark {...variant} layout="icon" size="82%" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
