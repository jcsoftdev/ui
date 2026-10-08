import type { APIRoute } from "astro";
import { buildLlmsFull } from "../../scripts/lib/llms.mjs";
import { baseUrl, LLMS_NAME, LLMS_SUMMARY } from "../lib/llms-config";
import { getDocPages } from "../lib/pages";

export const GET: APIRoute = async ({ site }) => {
  const pages = await getDocPages();
  const body = buildLlmsFull({
    name: LLMS_NAME,
    summary: LLMS_SUMMARY,
    baseUrl: baseUrl(site),
    pages,
  });
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
