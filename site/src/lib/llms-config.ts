export const LLMS_NAME = "@jcsoftdev/ui";

export const LLMS_SUMMARY =
  "Token-driven React 19 component library (zero runtime dependencies, Tailwind CSS v4, no runtime CSS-in-JS): atoms, forms, containers, overlays, about one hundred pure-SVG charts, a spreadsheet-grade DataGrid, an AI chat kit, rich text, XLSX and brand tools, themed by data-style, data-density, data-radius, data-accent and data-theme attributes.";

export const LLMS_DETAILS = `Import a component from its category, for example \`import { Button } from "@jcsoftdev/ui/atoms"\`, or from a single-component entry such as \`@jcsoftdev/ui/containers/data-grid\`. Components adapt to their container width (Tailwind container queries), not the viewport. Component pages are generated from the library source, so prop names, types and defaults are exact. Sample data is Spanish (a barbershop); identifiers and docs are English.`;

/** Absolute prefix for links; empty (root-relative links) when SITE_URL is not set at build time. */
export const baseUrl = (site: URL | undefined) =>
  site ? site.origin + site.pathname.replace(/\/$/, "") : "";

export const OPTIONAL_LINKS = (storybookUrl: string) => [
  {
    title: "Storybook",
    url: `${storybookUrl.replace(/\/$/, "")}/`,
    description: "Interactive stories for every component, with controls and accessibility checks",
  },
  {
    title: "Component manifest (JSON)",
    url: "/manifest.json",
    description: "Machine-readable list of components, import paths, props and story ids",
  },
  {
    title: "Complete documentation",
    url: "/llms-full.txt",
    description: "Every page concatenated into one file",
  },
];
