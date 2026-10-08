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

/**
 * Mirrors web/src/lib/theme.ts: `data-theme="light|dark"` and `data-accent="<palette>"`
 * on <html>. Coral is the default palette and carries no `data-accent` attribute.
 */
const withTheme: Decorator = (Story, context) => {
  const theme = context.globals.theme === "dark" ? "dark" : "light";
  const accent = String(context.globals.accent ?? "coral");

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    if (accent === "coral") delete root.dataset.accent;
    else root.dataset.accent = accent;
  }, [theme, accent]);

  // Components size themselves with container queries, so the width under test is the
  // container's, not the viewport's. The frame is a size container and can be dragged.
  const width = CONTAINER_WIDTHS[String(context.globals.container ?? "full")];

  return (
    <div lang="es-PE" className="min-h-screen bg-bg p-6 text-ink">
      <div
        className="@container max-w-full"
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
  initialGlobals: { theme: "light", accent: "coral", container: "full" },
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
  },
  parameters: {
    layout: "fullscreen",
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    backgrounds: { disabled: true },
    docs: { toc: true },
  },
};

export default preview;
