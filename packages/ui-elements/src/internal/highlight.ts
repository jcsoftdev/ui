// Opt-in tokenizer for ts/js/json/bash/go/sql, ported from the React kit and only ever loaded by
// dynamic import. Concatenating every token's text always gives back the input, so the renderer
// never loses or invents characters.
import { type Language, resolveLanguage } from "./code-lang.js";

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
// Sticky patterns run at `lastIndex` with no `slice`, and every scan is bounded, so a hostile
// input (a long run of "${") stays linear.
const NUMBER = /(?:0[xX][\da-fA-F_]+|\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?)/y;
const BASH_VARIABLE = /\$(?:\w+|[?!#@*$])/y;
const MAX_BRACE = 256;
const KEY_COLON = /\s{0,40}:/y;

function match(pattern: RegExp, code: string, at: number): string | null {
  pattern.lastIndex = at;
  return pattern.exec(code)?.[0] ?? null;
}

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
  let closer = -1;
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
      const isKey = json && match(KEY_COLON, code, stop) !== null;
      push(tokens, isKey ? "property" : "string", code.slice(i, stop));
      i = stop;
      continue;
    }
    if (lang === "bash" && ch === "$") {
      let variable: string | null = null;
      if (code[i + 1] === "{") {
        // The next "}" is cached, so a long run of "${" with no closer costs one scan, not one each.
        if (closer < i) closer = code.indexOf("}", i);
        if (closer === -1) closer = code.length + 1;
        if (closer - i <= MAX_BRACE) {
          const body = code.slice(i, closer + 1);
          if (!body.includes("\n")) variable = body;
        }
      } else variable = match(BASH_VARIABLE, code, i);
      if (variable) {
        push(tokens, "variable", variable);
        i += variable.length;
        continue;
      }
    }
    const signed = json && ch === "-" && /\d/.test(code[i + 1] ?? "");
    if (/\d/.test(ch) || signed) {
      const sign = signed ? "-" : "";
      const number = match(NUMBER, code, i + sign.length);
      if (number) {
        push(tokens, "number", sign + number);
        i += sign.length + number.length;
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
