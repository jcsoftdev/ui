import { Fragment, type ReactNode } from "react";
import { cn } from "../../utils/cn.js";
import { CodeBlock } from "../code-block/code-block.js";
import { AiKeyframes } from "../internal/keyframes.js";
import { type Block, type Inline, parseMarkdown } from "./parse.js";

function Caret() {
  return (
    <span
      aria-hidden
      className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] bg-current"
      style={{ animation: "ui-ai-caret 1s steps(1) infinite" }}
    />
  );
}

function renderInline(nodes: Inline[]): ReactNode {
  return nodes.map((node, index) => {
    const key = index;
    switch (node.t) {
      case "text":
        return <Fragment key={key}>{node.v}</Fragment>;
      case "br":
        return <br key={key} />;
      case "code":
        return (
          <code
            key={key}
            className="rounded-badge bg-surface-sunken px-1 py-0.5 font-mono text-[0.9em]"
          >
            {node.v}
          </code>
        );
      case "strong":
        return <strong key={key}>{renderInline(node.c)}</strong>;
      case "em":
        return <em key={key}>{renderInline(node.c)}</em>;
      case "link":
        return node.href ? (
          <a
            key={key}
            href={node.href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-accent-ink underline underline-offset-2 focus-visible:focus-ring"
          >
            {renderInline(node.c)}
          </a>
        ) : (
          <span key={key}>{renderInline(node.c)}</span>
        );
      default:
        return null;
    }
  });
}

const HEADINGS = {
  1: "text-card-title font-bold",
  2: "text-row-title font-bold",
  3: "text-body font-bold",
  4: "text-body font-semibold",
  5: "text-meta font-semibold uppercase",
  6: "text-meta font-semibold text-ink-2",
} as const;

const ALIGN = { left: "text-left", center: "text-center", right: "text-right" } as const;

function renderBlock(block: Block, key: number, caret: boolean): ReactNode {
  const tail = caret ? <Caret /> : null;
  switch (block.t) {
    case "heading": {
      const Tag = `h${block.level}` as "h1";
      return (
        <Tag key={key} className={HEADINGS[block.level]}>
          {renderInline(block.c)}
          {tail}
        </Tag>
      );
    }
    case "p":
      return (
        <p key={key}>
          {renderInline(block.c)}
          {tail}
        </p>
      );
    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag
          key={key}
          start={block.ordered && block.start !== 1 ? block.start : undefined}
          className={cn("grid gap-1 pl-5", block.ordered ? "list-decimal" : "list-disc")}
        >
          {block.items.map((item, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: list items are positional
            <li key={index} className="pl-1">
              {renderInline(item.c)}
              {caret && index === block.items.length - 1 && item.children.length === 0 ? (
                <Caret />
              ) : null}
              {item.children.length > 0 ? (
                <div className="mt-1 grid gap-1">
                  {renderBlocks(item.children, caret && index === block.items.length - 1)}
                </div>
              ) : null}
            </li>
          ))}
        </Tag>
      );
    }
    case "code":
      return (
        <Fragment key={key}>
          <CodeBlock code={block.v} language={block.lang} />
          {tail}
        </Fragment>
      );
    case "quote":
      return (
        <blockquote key={key} className="grid gap-2 border-l-2 border-accent-line pl-3 text-ink-2">
          {renderBlocks(block.c, caret)}
        </blockquote>
      );
    case "hr":
      return <hr key={key} className="border-0 border-t-divider" />;
    case "table":
      return (
        <div key={key} className="max-w-full overflow-x-auto rounded-card border-card shadow-card">
          <table className="w-full border-collapse text-meta">
            <thead className="bg-surface-sunken">
              <tr>
                {block.head.map((cell, col) => (
                  <th
                    // biome-ignore lint/suspicious/noArrayIndexKey: columns are positional
                    key={col}
                    scope="col"
                    className={cn(
                      "px-3 py-1.5 font-semibold",
                      block.align[col]
                        ? ALIGN[block.align[col] as keyof typeof ALIGN]
                        : "text-left",
                    )}
                  >
                    {renderInline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
                <tr key={r} className="border-t-divider">
                  {row.map((cell, col) => (
                    <td
                      // biome-ignore lint/suspicious/noArrayIndexKey: columns are positional
                      key={col}
                      className={cn(
                        "px-3 py-1.5",
                        block.align[col]
                          ? ALIGN[block.align[col] as keyof typeof ALIGN]
                          : "text-left",
                      )}
                    >
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

function renderBlocks(blocks: Block[], caret: boolean): ReactNode {
  return blocks.map((block, index) =>
    renderBlock(block, index, caret && index === blocks.length - 1),
  );
}

export interface MarkdownProps {
  /** Markdown source. Raw HTML is shown as text; only http, https and mailto links are active. */
  children: string;
  /** Shows a blinking caret after the last character, for streaming answers. */
  streaming?: boolean;
  className?: string;
}

/**
 * Safe Markdown renderer: headings, lists, emphasis, inline code, code fences, quotes, tables
 * and links. It builds React elements from a parsed AST, so no input ever reaches innerHTML.
 */
export function Markdown({ children, streaming, className }: MarkdownProps) {
  const blocks = parseMarkdown(children);
  return (
    <div
      className={cn("grid min-w-0 gap-density break-words text-body leading-relaxed", className)}
    >
      {streaming ? <AiKeyframes /> : null}
      {renderBlocks(blocks, Boolean(streaming))}
      {streaming && blocks.length === 0 ? (
        <p>
          <Caret />
        </p>
      ) : null}
    </div>
  );
}
