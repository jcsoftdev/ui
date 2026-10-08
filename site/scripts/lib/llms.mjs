// llms.txt / llms-full.txt / per-page Markdown builders (llmstxt.org format). Pure functions.
//
// A page is { path, title, description, section, body } where `path` is the URL path without the
// `.md` suffix, e.g. "/docs/components/button".

const trimEnd = (s) => s.replace(/\s+$/, "");

export function absolute(baseUrl, p) {
  return `${baseUrl.replace(/\/$/, "")}${p}`;
}

/** Markdown served at `<path>.md`: the page as a standalone document. */
export function pageMarkdown(page, { baseUrl = "" } = {}) {
  const lines = [`# ${page.title}`, ""];
  if (page.description) lines.push(`> ${page.description.replace(/\s+/g, " ")}`, "");
  lines.push(`Source: ${absolute(baseUrl, page.path)}`, "");
  lines.push(trimEnd(page.body), "");
  return lines.join("\n");
}

/**
 * @param {{ name: string, summary: string, details?: string, baseUrl?: string, pages: object[], sectionOrder: string[], optional?: Array<{ title: string, url: string, description?: string }> }} input
 */
export function buildLlmsTxt({
  name,
  summary,
  details,
  baseUrl = "",
  pages,
  sectionOrder,
  optional = [],
}) {
  const out = [`# ${name}`, "", `> ${summary}`, ""];
  if (details) out.push(trimEnd(details), "");
  const bySection = new Map();
  for (const p of pages)
    (bySection.get(p.section) ?? bySection.set(p.section, []).get(p.section)).push(p);
  const order = [
    ...sectionOrder.filter((s) => bySection.has(s)),
    ...[...bySection.keys()].filter((s) => !sectionOrder.includes(s)),
  ];
  for (const section of order) {
    out.push(`## ${section}`, "");
    for (const p of bySection.get(section)) {
      const desc = p.description ? `: ${p.description.replace(/\s+/g, " ")}` : "";
      out.push(`- [${p.title}](${absolute(baseUrl, `${p.path}.md`)})${desc}`);
    }
    out.push("");
  }
  if (optional.length) {
    out.push("## Optional", "");
    for (const o of optional)
      out.push(`- [${o.title}](${o.url})${o.description ? `: ${o.description}` : ""}`);
    out.push("");
  }
  return `${trimEnd(out.join("\n"))}\n`;
}

export function buildLlmsFull({ name, summary, baseUrl = "", pages }) {
  const head = [
    `# ${name} - full documentation`,
    "",
    `> ${summary}`,
    "",
    `Every documentation page below is also available on its own at <page URL>.md. Index: ${absolute(baseUrl, "/llms.txt")}`,
    "",
  ];
  const parts = pages.map((p) => trimEnd(pageMarkdown(p, { baseUrl })));
  return `${trimEnd(head.join("\n"))}\n\n---\n\n${parts.join("\n\n---\n\n")}\n`;
}

/** Returns a list of format problems; empty when the file follows llmstxt.org. */
export function validateLlmsTxt(text) {
  const errors = [];
  const lines = text.split("\n");
  if (!/^# \S/.test(lines[0] ?? "")) errors.push("first line must be an H1");
  if (lines.filter((l) => /^# /.test(l)).length !== 1) errors.push("exactly one H1 is allowed");
  const firstBlock = lines.slice(1).find((l) => l.trim() !== "");
  if (!firstBlock?.startsWith("> ")) errors.push("a blockquote summary must follow the H1");
  if (lines.some((l) => /^#{3,} /.test(l)))
    errors.push("only H2 sections are allowed after the header");
  let inSection = false;
  for (const l of lines) {
    if (/^## /.test(l)) inSection = true;
    else if (inSection && l.trim() !== "" && !/^- \[[^\]]+\]\([^)\s]+\)(: .+)?$/.test(l))
      errors.push(`invalid list item: ${l}`);
  }
  if (!inSection) errors.push("at least one H2 section is required");
  return errors;
}
