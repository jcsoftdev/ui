// Tiny single-pass tokenizer for ts/js/json/bash/go/sql. Concatenating every token's text
// always gives back the input, so the renderer never loses or invents characters.

export type TokenType =
  | "plain"
  | "keyword"
  | "string"
  | "comment"
  | "number"
  | "function"
  | "type"
  | "property"
  | "variable"
  | "punctuation";

export interface Token {
  type: TokenType;
  text: string;
}

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

/** Maps a fence label (`typescript`, `sh`…) to a supported language, or null. */
export function resolveLanguage(label: string | undefined): Language | null {
  return ALIASES[(label ?? "").trim().toLowerCase()] ?? null;
}

const words = (list: string) => new Set(list.split(" "));

const JS_KEYWORDS = words(
  "as async await break case catch class const continue debugger default delete do else enum export extends finally for from function if implements import in instanceof interface let new of private protected public readonly return static super switch this throw try type typeof var void while with yield true false null undefined",
);

interface Spec {
  line: string[];
  block: [string, string] | null;
  quotes: string;
  keywords: Set<string>;
  ignoreCase: boolean;
}

const SPECS: Record<Exclude<Language, "json">, Spec> = {
  ts: {
    line: ["//"],
    block: ["/*", "*/"],
    quotes: "'\"`",
    keywords: JS_KEYWORDS,
    ignoreCase: false,
  },
  js: {
    line: ["//"],
    block: ["/*", "*/"],
    quotes: "'\"`",
    keywords: JS_KEYWORDS,
    ignoreCase: false,
  },
  go: {
    line: ["//"],
    block: ["/*", "*/"],
    quotes: "'\"`",
    keywords: words(
      "break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var true false nil",
    ),
    ignoreCase: false,
  },
  bash: {
    line: ["#"],
    block: null,
    quotes: "'\"",
    keywords: words(
      "if then else elif fi for while until do done case esac in function select return export local readonly echo cd exit set unset source alias",
    ),
    ignoreCase: false,
  },
  sql: {
    line: ["--"],
    block: ["/*", "*/"],
    quotes: "'\"",
    keywords: words(
      "select from where and or not in is null as join left right inner outer full cross on group by order having limit offset insert into values update set delete create table alter drop index primary key foreign references unique default distinct union all case when then else end like between exists count sum avg min max asc desc with returning true false",
    ),
    ignoreCase: true,
  },
};

const IDENT_START = /[A-Za-z_$]/;
const IDENT = /[\w$]/;
const NUMBER = /^(?:0[xX][\da-fA-F_]+|\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?)/;

function push(tokens: Token[], type: TokenType, text: string) {
  if (!text) return;
  const last = tokens[tokens.length - 1];
  if (last && last.type === type && (type === "plain" || type === "punctuation")) last.text += text;
  else tokens.push({ type, text });
}

function readString(code: string, start: number, quote: string): number {
  let i = start + 1;
  while (i < code.length) {
    const ch = code[i];
    if (ch === "\\") i += 2;
    else if (ch === quote) return i + 1;
    else if (ch === "\n" && quote !== "`") return i;
    else i += 1;
  }
  return code.length;
}

export function tokenize(code: string, language: string | undefined): Token[] {
  const lang = resolveLanguage(language);
  if (!lang) return [{ type: "plain", text: code }];
  const json = lang === "json";
  const spec = json ? SPECS.js : SPECS[lang as Exclude<Language, "json">];
  const quotes = json ? '"' : spec.quotes;
  const tokens: Token[] = [];
  let i = 0;
  while (i < code.length) {
    const ch = code[i] as string;
    const lineMark = spec.line.find((mark) => code.startsWith(mark, i));
    if (lineMark) {
      const end = code.indexOf("\n", i);
      const stop = end === -1 ? code.length : end;
      push(tokens, "comment", code.slice(i, stop));
      i = stop;
      continue;
    }
    if (spec.block && code.startsWith(spec.block[0], i)) {
      const end = code.indexOf(spec.block[1], i + 2);
      const stop = end === -1 ? code.length : end + spec.block[1].length;
      push(tokens, "comment", code.slice(i, stop));
      i = stop;
      continue;
    }
    if (quotes.includes(ch)) {
      const stop = readString(code, i, ch);
      const isKey = json && /^\s*:/.test(code.slice(stop, stop + 40));
      push(tokens, isKey ? "property" : "string", code.slice(i, stop));
      i = stop;
      continue;
    }
    if (lang === "bash" && ch === "$") {
      const match = /^\$(?:\{[^}]*\}|\w+|[?!#@*$])/.exec(code.slice(i));
      if (match) {
        push(tokens, "variable", match[0]);
        i += match[0].length;
        continue;
      }
    }
    const signed = json && ch === "-" && /\d/.test(code[i + 1] ?? "");
    if (/\d/.test(ch) || signed) {
      const sign = signed ? "-" : "";
      const match = NUMBER.exec(code.slice(i + sign.length));
      if (match) {
        push(tokens, "number", sign + match[0]);
        i += sign.length + match[0].length;
        continue;
      }
    }
    if (IDENT_START.test(ch)) {
      let stop = i + 1;
      while (stop < code.length && IDENT.test(code[stop] as string)) stop += 1;
      const word = code.slice(i, stop);
      const key = spec.ignoreCase ? word.toLowerCase() : word;
      let type: TokenType = "plain";
      if (spec.keywords.has(key)) type = "keyword";
      else if (/^[A-Z]/.test(word) && !json && lang !== "sql" && lang !== "bash") type = "type";
      else if (code[stop] === "(" && lang !== "sql") type = "function";
      push(tokens, type, word);
      i = stop;
      continue;
    }
    push(tokens, /[{}()[\];,.:<>=+\-*/%!&|?^~@]/.test(ch) ? "punctuation" : "plain", ch);
    i += 1;
  }
  return tokens;
}
