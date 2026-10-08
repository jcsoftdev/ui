import type { APIRoute } from "astro";
import { buildLlmsTxt } from "../../scripts/lib/llms.mjs";
import { baseUrl, LLMS_DETAILS, LLMS_NAME, LLMS_SUMMARY, OPTIONAL_LINKS } from "../lib/llms-config";
import { getDocPages, SECTION_ORDER } from "../lib/pages";

export const GET: APIRoute = async ({ site }) => {
  const pages = await getDocPages();
  const base = baseUrl(site);
  const sections = [...new Set(pages.map((p) => p.section))];
  const body = buildLlmsTxt({
    name: LLMS_NAME,
    summary: LLMS_SUMMARY,
    details: LLMS_DETAILS,
    baseUrl: base,
    pages,
    sectionOrder: [...SECTION_ORDER, ...sections],
    optional: OPTIONAL_LINKS(import.meta.env.PUBLIC_STORYBOOK_URL || "/storybook").map((o) => ({
      ...o,
      url: o.url.startsWith("/") ? `${base}${o.url}` : o.url,
    })),
  });
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
