/**
 * Allowlist HTML sanitizer for the rich text editor. It is a small string tokenizer with no DOM
 * dependency, so it runs the same on the server, in the browser and in tests.
 *
 * Rules:
 * - Only the tags in `ALLOWED_TAGS` survive, and only without attributes, except `<a href>`.
 * - Unknown tags are unwrapped (their text stays); `DROP_WITH_CONTENT` tags lose their content too.
 * - `href` must be http(s), mailto, tel, or a relative/fragment link. Everything else
 *   (javascript:, data:, vbscript:, ...) is removed after entity decoding and control-char stripping.
 * - Output is rebuilt from tokens, always re-escaped and always balanced.
 */

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "em",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "a",
  "h2",
  "h3",
  "blockquote",
]);

/** Equivalent tags are renamed so the output vocabulary stays small. */
const TAG_ALIASES: Record<string, string> = {
  b: "strong",
  i: "em",
  strike: "s",
  del: "s",
  h1: "h2",
  h4: "h3",
  h5: "h3",
  h6: "h3",
  div: "p",
};

const DROP_WITH_CONTENT = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "svg",
  "math",
  "template",
  "noscript",
  "textarea",
  "select",
  "title",
  "head",
  "frameset",
  "applet",
  "xmp",
  "noembed",
  "noframes",
  "plaintext",
]);

const VOID_TAGS = new Set(["br"]);

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  colon: ":",
  tab: "\t",
  newline: "\n",
  sol: "/",
};

let decoder: HTMLTextAreaElement | null | undefined;
const decodedNames = new Map<string, string>();

/**
 * Full HTML5 named-entity decoding. With a DOM, the engine's own parser does it through a detached
 * textarea (it runs no script and loads nothing, and the input is only `&name;` characters); without
 * one, only the small table above applies.
 */
function decodeNamed(match: string, body: string): string {
  const known = NAMED_ENTITIES[body.toLowerCase()];
  if (known !== undefined) return known;
  if (decoder === undefined)
    decoder = typeof document === "undefined" ? null : document.createElement("textarea");
  if (!decoder) return match;
  let out = decodedNames.get(match);
  if (out === undefined) {
    decoder.innerHTML = match;
    out = decoder.value;
    if (decodedNames.size > 512) decodedNames.clear();
    decodedNames.set(match, out);
  }
  return out;
}

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);?/gi, (match, body: string) => {
    if (body[0] === "#") {
      const code =
        body[1]?.toLowerCase() === "x" ? Number.parseInt(body.slice(2), 16) : Number(body.slice(1));
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return "";
      return String.fromCodePoint(code);
    }
    return decodeNamed(match, body);
  });
}

function escapeText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttribute(text: string): string {
  return escapeText(text).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function isInvisible(code: number): boolean {
  return (
    code <= 0x20 ||
    (code >= 0x7f && code <= 0x9f) ||
    (code >= 0x200b && code <= 0x200d) ||
    code === 0x2028 ||
    code === 0x2029 ||
    code === 0xfeff
  );
}

const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

/** The one normalization of an href: entity-decoded and trimmed. It is validated and emitted as is. */
function normalizeHref(raw: string): string {
  return decodeEntities(raw).trim();
}

function isSafeNormalized(href: string): boolean {
  // Drop every invisible, whitespace and format character ("java\tscript:", "\u00a0javascript:").
  const url = Array.from(href)
    .filter((char) => !isInvisible(char.codePointAt(0) ?? 0))
    .join("")
    .replace(/[\s\p{Cf}]/gu, "");
  if (url === "") return false;
  try {
    return SAFE_PROTOCOLS.has(new URL(url, "https://invalid.invalid/").protocol);
  } catch {
    return false;
  }
}

/** True for http(s), mailto, tel and scheme-less (relative or fragment) URLs. */
export function isSafeUrl(raw: string): boolean {
  return isSafeNormalized(normalizeHref(raw));
}

interface ParsedTag {
  name: string;
  closing: boolean;
  attributes: Record<string, string>;
  end: number;
}

function parseTag(html: string, start: number): ParsedTag | null {
  const match = /^<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)/.exec(html.slice(start, start + 64));
  if (!match) return null;
  let i = start + match[0].length;
  const attributes: Record<string, string> = {};
  const length = html.length;
  while (i < length) {
    while (i < length && /[\s/]/.test(html[i] as string)) i++;
    if (html[i] === ">")
      return {
        name: (match[2] as string).toLowerCase(),
        closing: match[1] === "/",
        attributes,
        end: i + 1,
      };
    const nameStart = i;
    while (i < length && !/[\s/=>]/.test(html[i] as string)) i++;
    const name = html.slice(nameStart, i).toLowerCase();
    while (i < length && /\s/.test(html[i] as string)) i++;
    let value = "";
    if (html[i] === "=") {
      i++;
      while (i < length && /\s/.test(html[i] as string)) i++;
      const quote = html[i];
      if (quote === '"' || quote === "'") {
        const close = html.indexOf(quote, i + 1);
        const stop = close === -1 ? length : close;
        value = html.slice(i + 1, stop);
        i = stop + 1;
      } else {
        const valueStart = i;
        while (i < length && !/[\s>]/.test(html[i] as string)) i++;
        value = html.slice(valueStart, i);
      }
    }
    if (name && !(name in attributes)) attributes[name] = value;
  }
  // Unterminated tag: drop the remainder (an empty name is never allowed).
  return {
    name: "",
    closing: match[1] === "/",
    attributes,
    end: length,
  };
}

/** Deepest run of open elements kept; tags beyond it are unwrapped (their text stays). */
const MAX_OPEN_DEPTH = 128;

/** Returns safe, balanced HTML containing only the editor's vocabulary. */
export function sanitizeHtml(input: string): string {
  const html = String(input ?? "");
  const out: string[] = [];
  const stack: string[] = [];
  let i = 0;

  // Open count per tag: an unmatched closer then costs O(1) instead of a scan of the whole stack.
  const open: Record<string, number> = Object.create(null);
  const pop = () => {
    const name = stack.pop() as string;
    open[name] = (open[name] as number) - 1;
    out.push(`</${name}>`);
  };
  const push = (name: string) => {
    stack.push(name);
    open[name] = (open[name] ?? 0) + 1;
  };
  const closeTo = (name: string) => {
    if (!open[name]) return;
    const at = stack.lastIndexOf(name);
    while (stack.length > at) pop();
  };

  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      out.push(escapeText(decodeEntities(html.slice(i))));
      break;
    }
    if (lt > i) out.push(escapeText(decodeEntities(html.slice(i, lt))));

    if (html.startsWith("<!--", lt)) {
      const close = html.indexOf("-->", lt + 4);
      i = close === -1 ? html.length : close + 3;
      continue;
    }
    if (html[lt + 1] === "!" || html[lt + 1] === "?") {
      const close = html.indexOf(">", lt);
      i = close === -1 ? html.length : close + 1;
      continue;
    }

    const tag = parseTag(html, lt);
    if (!tag) {
      out.push("&lt;");
      i = lt + 1;
      continue;
    }
    i = tag.end;

    if (!tag.closing && DROP_WITH_CONTENT.has(tag.name)) {
      const closer = new RegExp(`</${tag.name}[\\s/>]`, "gi");
      closer.lastIndex = i;
      const found = closer.exec(html);
      if (!found) {
        i = html.length;
      } else {
        const close = html.indexOf(">", found.index);
        i = close === -1 ? html.length : close + 1;
      }
      continue;
    }

    const name = TAG_ALIASES[tag.name] ?? tag.name;
    if (!ALLOWED_TAGS.has(name)) continue;

    if (tag.closing) {
      if (!VOID_TAGS.has(name)) closeTo(name);
      continue;
    }
    if (VOID_TAGS.has(name)) {
      out.push("<br>");
      continue;
    }
    if (name === "a") {
      closeTo("a");
      if (stack.length >= MAX_OPEN_DEPTH) continue;
      const href = tag.attributes.href;
      const normalized = href === undefined ? "" : normalizeHref(href);
      if (isSafeNormalized(normalized)) {
        out.push(
          `<a href="${escapeAttribute(normalized)}" rel="noopener noreferrer nofollow" target="_blank">`,
        );
      } else {
        out.push("<a>");
      }
      push("a");
      continue;
    }
    // Block elements cannot nest inside inline ones or inside paragraphs; close what they would break.
    if (name === "p" || name === "h2" || name === "h3" || name === "blockquote") {
      for (const open of ["p", "h2", "h3"]) closeTo(open);
    }
    if (name === "li") closeTo("li");
    if (stack.length >= MAX_OPEN_DEPTH) continue;
    out.push(`<${name}>`);
    push(name);
  }

  while (stack.length) pop();
  return out.join("").replace(/<a><\/a>/g, "");
}

/** Plain text of sanitized HTML, used to detect an empty editor. */
export function htmlToText(html: string): string {
  return decodeEntities(html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, "")).trim();
}

/** Replaces the children of `element` with the sanitized `html`. The only sink this module offers. */
export function setSafeHtml(element: Element, html: string): void {
  element.innerHTML = sanitizeHtml(html);
}
