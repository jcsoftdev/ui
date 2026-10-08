import { getCollection } from "astro:content";
import { categoryTitle } from "../../scripts/lib/render.mjs";

export interface DocPage {
  id: string;
  /** URL path without the `.md` suffix, e.g. "/docs/components/button". */
  path: string;
  title: string;
  description: string;
  section: string;
  body: string;
}

const GUIDE_ORDER = [
  "docs",
  "docs/getting-started",
  "docs/subpaths",
  "docs/container-queries",
  "docs/accessibility",
  "docs/llms",
];

const sectionOf = (id: string, data: { section?: string; category?: string }) => {
  if (data.category) return `Components: ${categoryTitle(data.category)}`;
  if (data.section) return data.section;
  if (id.startsWith("docs/theming")) return "Theming";
  if (id.startsWith("docs/reference")) return "Reference";
  return "Guides";
};

/** Page path of the `.md` variant: the docs root becomes /docs/index. */
export const pathOf = (id: string) => (id === "docs" ? "/docs/index" : `/${id}`);

/** Every documentation page in reading order: guides, theming, components by category, reference. */
export async function getDocPages(): Promise<DocPage[]> {
  const entries = await getCollection("docs", (e) => e.id === "docs" || e.id.startsWith("docs/"));
  const rank = (id: string, section: string) => {
    if (section === "Guides") return [0, GUIDE_ORDER.indexOf(id)] as const;
    if (section === "Theming") return [1, id === "docs/theming" ? 0 : 1] as const;
    if (section === "Reference") return [3, 0] as const;
    return [2, 0] as const;
  };
  const pages = entries.map((e) => ({
    id: e.id,
    path: pathOf(e.id),
    title: e.data.title,
    description: e.data.description ?? "",
    section: sectionOf(e.id, e.data),
    body: e.body ?? "",
  }));
  return pages.sort((a, b) => {
    const [ra, ia] = rank(a.id, a.section);
    const [rb, ib] = rank(b.id, b.section);
    return (
      ra - rb || ia - ib || a.section.localeCompare(b.section) || a.title.localeCompare(b.title)
    );
  });
}

export const SECTION_ORDER = ["Guides", "Theming"];
