import type { Decorator, Preview } from "@storybook/react-vite";
import { useEffect } from "react";
import "./storybook.css";

const ACCENTS = [
  { value: "coral", title: "Coral" },
  { value: "durazno", title: "Durazno" },
  { value: "menta", title: "Menta" },
  { value: "cielo", title: "Cielo" },
  { value: "lavanda", title: "Lavanda" },
  { value: "orquidea", title: "Orquídea" },
  { value: "grafito", title: "Grafito" },
];

const STYLES = [
  { value: "soft", title: "Suave" },
  { value: "bordered", title: "Con bordes" },
  { value: "elevated", title: "Elevado" },
  { value: "flat", title: "Plano" },
  { value: "glass", title: "Vidrio" },
  { value: "brutal", title: "Brutal" },
];

const DENSITIES = [
  { value: "compact", title: "Compacta" },
  { value: "normal", title: "Normal" },
  { value: "comfortable", title: "Cómoda" },
];

const RADII = [
  { value: "preset", title: "Del estilo" },
  { value: "none", title: "Sin radio" },
  { value: "sm", title: "Pequeño" },
  { value: "md", title: "Medio" },
  { value: "lg", title: "Grande" },
  { value: "full", title: "Completo" },
];

/** Sets `data-<name>` on the root, or removes it when the value is the default. */
function setRootAttribute(name: string, value: string, fallback: string) {
  const root = document.documentElement;
  if (value === fallback) delete root.dataset[name];
  else root.dataset[name] = value;
}

/**
 * Mirrors web/src/lib/theme.ts: `data-theme="light|dark"` and `data-accent="<palette>"`
 * on <html>. Coral is the default palette and carries no `data-accent` attribute.
 */
const withTheme: Decorator = (Story, context) => {
  const theme = context.globals.theme === "dark" ? "dark" : "light";
  const accent = String(context.globals.accent ?? "coral");
  const style = String(context.globals.style ?? "soft");
  const density = String(context.globals.density ?? "normal");
  const radius = String(context.globals.radius ?? "preset");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    setRootAttribute("accent", accent, "coral");
    // Style presets: see styles/README section in .storybook/README.md.
    setRootAttribute("style", style, "soft");
    setRootAttribute("density", density, "normal");
    setRootAttribute("radius", radius, "preset");
  }, [theme, accent, style, density, radius]);

  // Components size themselves with container queries, so the width under test is the
  // container's, not the viewport's. The frame is a size container and can be dragged.
  const width = CONTAINER_WIDTHS[String(context.globals.container ?? "full")];

  return (
    <div
      lang="es-PE"
      className="min-h-screen bg-bg p-6 text-ink"
      style={{ backgroundImage: "var(--page-backdrop)" }}
    >
      <div
        className="@container/page max-w-full"
        style={
          width
            ? {
                width,
                resize: "horizontal",
                overflow: "auto",
                outline: "1px dashed var(--line)",
              }
            : undefined
        }
      >
        <Story />
      </div>
    </div>
  );
};

const CONTAINER_WIDTHS: Record<string, string | undefined> = {
  full: undefined,
  "320": "320px",
  "480": "480px",
  "768": "768px",
  "1024": "1024px",
};

const preview: Preview = {
  decorators: [withTheme],
  initialGlobals: {
    theme: "light",
    accent: "coral",
    container: "full",
    style: "soft",
    density: "normal",
    radius: "preset",
  },
  globalTypes: {
    theme: {
      description: "Tema",
      toolbar: {
        title: "Tema",
        icon: "circlehollow",
        dynamicTitle: true,
        items: [
          { value: "light", title: "Claro", icon: "sun" },
          { value: "dark", title: "Oscuro", icon: "moon" },
        ],
      },
    },
    container: {
      description: "Ancho del contenedor (container queries)",
      toolbar: {
        title: "Contenedor",
        icon: "grow",
        dynamicTitle: true,
        items: [
          { value: "full", title: "Completo" },
          { value: "320", title: "320 px" },
          { value: "480", title: "480 px" },
          { value: "768", title: "768 px" },
          { value: "1024", title: "1024 px" },
        ],
      },
    },
    accent: {
      description: "Paleta de acento",
      toolbar: {
        title: "Paleta",
        icon: "paintbrush",
        dynamicTitle: true,
        items: ACCENTS,
      },
    },
    style: {
      description: "Estilo (data-style)",
      toolbar: { title: "Estilo", icon: "component", dynamicTitle: true, items: STYLES },
    },
    density: {
      description: "Densidad (data-density)",
      toolbar: { title: "Densidad", icon: "listunordered", dynamicTitle: true, items: DENSITIES },
    },
    radius: {
      description: "Radio de esquinas (data-radius)",
      toolbar: { title: "Radio", icon: "circle", dynamicTitle: true, items: RADII },
    },
  },
  parameters: {
    layout: "fullscreen",
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    backgrounds: { disabled: true },
    docs: { toc: true },
  },
};

export default preview;
