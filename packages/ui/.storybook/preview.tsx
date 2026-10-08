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

  return (
    <div lang="es-PE" className="min-h-screen bg-bg p-6 text-ink">
      <Story />
    </div>
  );
};

const preview: Preview = {
  decorators: [withTheme],
  initialGlobals: { theme: "light", accent: "coral" },
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
