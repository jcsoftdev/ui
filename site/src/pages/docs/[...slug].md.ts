import type { APIRoute, GetStaticPaths } from "astro";
import { pageMarkdown } from "../../../scripts/lib/llms.mjs";
import { baseUrl } from "../../lib/llms-config";
import { getDocPages, type DocPage } from "../../lib/pages";

// One `.md` file per documentation page, e.g. /docs/components/data-grid.md.
export const getStaticPaths = (async () => {
  const pages = await getDocPages();
  return pages.map((page) => ({
    params: { slug: page.path.replace(/^\/docs\//, "") },
    props: { page },
  }));
}) satisfies GetStaticPaths;

export const GET: APIRoute<{ page: DocPage }> = ({ props, site }) =>
  new Response(pageMarkdown(props.page, { baseUrl: baseUrl(site) }), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
