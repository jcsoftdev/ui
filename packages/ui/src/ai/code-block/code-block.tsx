"use client";

import { useMemo } from "react";
import { Check, Copy } from "../../icons/index.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { IconAction } from "../internal/icon-action.js";
import { useCopy } from "../internal/use-copy.js";
import { resolveLanguage, type TokenType, tokenize } from "./highlight.js";

const tokenClasses: Record<TokenType, string> = {
  plain: "",
  punctuation: "text-ink-3",
  keyword: "text-accent-ink font-medium",
  string: "text-success",
  comment: "text-ink-3 italic",
  number: "text-warning",
  function: "text-pal-cielo-deep",
  type: "text-pal-orquidea-deep",
  property: "text-pal-cielo-ink",
  variable: "text-warning",
};

const LABELS = {
  ts: "TypeScript",
  js: "JavaScript",
  json: "JSON",
  bash: "Bash",
  go: "Go",
  sql: "SQL",
};

export type CodeBlockPart = "root" | "header" | "title" | "actions" | "pre" | "code";

export interface CodeBlockProps {
  code: string;
  /** `ts`, `js`, `json`, `bash`, `go` or `sql` (aliases like `typescript` work); anything else is plain. */
  language?: string;
  /** Optional file name shown instead of the language label. */
  filename?: string;
  /** Wrap long lines instead of scrolling horizontally. */
  wrap?: boolean;
  className?: string;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root. */
  classNames?: ClassNames<CodeBlockPart>;
}

/** Code with a language label, a copy button and a dependency-free syntax highlighter. */
export function CodeBlock({
  code,
  language,
  filename,
  wrap,
  className,
  classNames,
}: CodeBlockProps) {
  const { copied, copy } = useCopy();
  const tokens = useMemo(() => tokenize(code, language), [code, language]);
  const resolved = resolveLanguage(language);
  const title = filename ?? (resolved ? LABELS[resolved] : language?.trim() || "Texto");

  return (
    <figure
      className={cn(
        "@container/code m-0 min-w-0 max-w-full overflow-hidden rounded-card bg-surface-sunken text-ink border-card shadow-card",
        className,
        classNames?.root,
      )}
    >
      <figcaption
        className={cn(
          "flex items-center justify-between gap-density-sm border-b-divider px-3 py-1",
          classNames?.header,
        )}
      >
        <span className={cn("min-w-0 truncate font-mono text-meta text-ink-3", classNames?.title)}>
          {title}
        </span>
        <span aria-live="polite" className={cn("flex items-center gap-1", classNames?.actions)}>
          {copied ? <span className="text-meta text-success">Copiado</span> : null}
          <IconAction
            label={copied ? "Código copiado" : "Copiar código"}
            onClick={() => copy(code)}
          >
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          </IconAction>
        </span>
      </figcaption>
      <pre
        // biome-ignore lint/a11y/noNoninteractiveTabindex: scrollable region must be keyboard reachable
        tabIndex={0}
        className={cn(
          "m-0 p-3 font-mono text-fs-125 leading-relaxed focus-visible:focus-ring",
          wrap ? "whitespace-pre-wrap break-words" : "overflow-x-auto",
          classNames?.pre,
        )}
      >
        <code className={classNames?.code}>
          {tokens.map((token, index) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: tokens are positional and never reorder
              key={index}
              className={tokenClasses[token.type] || undefined}
            >
              {token.text}
            </span>
          ))}
        </code>
      </pre>
    </figure>
  );
}
