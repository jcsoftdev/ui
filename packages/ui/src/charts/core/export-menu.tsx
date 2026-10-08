"use client";

import { useRef } from "react";
import { cn } from "../../utils/cn.js";
import { downloadPng, downloadSvg, exportFileName } from "./export.js";

export interface ExportTexts {
  /** Accessible name of the group and prefix of each button's name. */
  export: string;
  svg: string;
  png: string;
}

export const DEFAULT_EXPORT_TEXTS: ExportTexts = { export: "Export", svg: "SVG", png: "PNG" };

/**
 * Two compact buttons that download the chart drawing as SVG or PNG.
 * `getSvgs` runs on click, so it can read the live DOM.
 */
export function ExportMenu({
  title,
  getSvgs,
  getLeading,
  texts = DEFAULT_EXPORT_TEXTS,
  className,
}: {
  title: string;
  /** Receives the menu's own element, to find the chart around it. */
  getSvgs: (root: HTMLElement) => SVGSVGElement[];
  /** A mounted drawing placed left of the others; removed from the page once exported. */
  getLeading?: (root: HTMLElement) => SVGSVGElement | null;
  texts?: ExportTexts;
  className?: string;
}) {
  const rootRef = useRef<HTMLFieldSetElement>(null);
  const run = (kind: "svg" | "png") => {
    const svgs = rootRef.current ? getSvgs(rootRef.current) : [];
    if (svgs.length === 0) return;
    const fileName = exportFileName(title, kind);
    const leading = rootRef.current ? (getLeading?.(rootRef.current) ?? undefined) : undefined;
    // Both downloads serialize synchronously, so the helper drawing can go right after.
    if (kind === "svg") downloadSvg(svgs, { fileName, leading });
    else void downloadPng(svgs, { fileName, leading });
    leading?.remove();
  };
  return (
    <fieldset
      ref={rootRef}
      className={cn(
        "m-0 flex shrink-0 items-center gap-0.5 rounded-button border-0 bg-surface-2 p-0.5",
        className,
      )}
    >
      <legend className="sr-only">{texts.export}</legend>
      {(["svg", "png"] as const).map((kind) => (
        <button
          key={kind}
          type="button"
          aria-label={`${texts.export} ${texts[kind]}`}
          onClick={() => run(kind)}
          className="cursor-pointer rounded-button px-2 py-1 font-semibold text-[11.5px] text-ink-3 outline-none hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-accent-ink"
        >
          {texts[kind]}
        </button>
      ))}
    </fieldset>
  );
}
