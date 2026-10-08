import type { APIRoute } from "astro";
import manifest from "../generated/manifest.json";

// Machine-readable component list for tools and agents (props, import paths, story ids).
export const GET: APIRoute = () =>
  new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
