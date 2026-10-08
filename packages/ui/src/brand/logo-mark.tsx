import { createElement, type ReactNode } from "react";
import { cn } from "../utils/cn.js";
import { generateMark, type MarkNode, type MarkOptions } from "./generate.js";

const camel = (name: string) => name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

function renderNode(node: MarkNode, key: number): ReactNode {
  const props: Record<string, unknown> = { key };
  for (const [name, value] of Object.entries(node.attrs)) {
    if (value !== undefined) props[camel(name)] = value;
  }
  const children = [
    ...(node.children ?? []).map(renderNode),
    ...(node.text === undefined ? [] : [node.text]),
  ];
  return createElement(node.tag, props, ...children);
}

export interface LogoMarkProps extends MarkOptions {
  /** CSS width of the mark; the height follows the aspect ratio. Defaults to the full container. */
  size?: number | string;
  className?: string;
}

/** Renders a generated brand mark as an inline `<svg role="img">`. */
export function LogoMark({ size = "100%", className, ...options }: LogoMarkProps) {
  const mark = generateMark(options);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={mark.viewBox}
      role="img"
      aria-label={mark.label}
      className={cn("block h-auto max-w-full", className)}
      style={{ width: size }}
    >
      {mark.nodes.map(renderNode)}
    </svg>
  );
}
