/** Languages the opt-in highlighter understands, and the labels shown for them. */
export type Language = "ts" | "js" | "json" | "bash" | "go" | "sql";

const ALIASES: Record<string, Language> = {
  ts: "ts",
  typescript: "ts",
  tsx: "ts",
  js: "js",
  javascript: "js",
  jsx: "js",
  mjs: "js",
  json: "json",
  jsonc: "json",
  bash: "bash",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  go: "go",
  golang: "go",
  sql: "sql",
};

export const LANGUAGE_LABELS: Record<Language, string> = {
  ts: "TypeScript",
  js: "JavaScript",
  json: "JSON",
  bash: "Bash",
  go: "Go",
  sql: "SQL",
};

/** Maps a fence label (`typescript`, `sh`...) to a supported language, or null. */
export function resolveLanguage(label: string | null | undefined): Language | null {
  return ALIASES[(label ?? "").trim().toLowerCase()] ?? null;
}
