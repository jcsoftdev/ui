"use client";

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
  texts = DEFAULT_EXPORT_TEXTS,
  className,
}: {
  title: string;
  getSvgs: () => SVGSVGElement[];
  texts?: ExportTexts;
  className?: string;
}) {
  const run = (kind: "svg" | "png") => {
    const svgs = getSvgs();
    if (svgs.length === 0) return;
    const fileName = exportFileName(title, kind);
    if (kind === "svg") downloadSvg(svgs, { fileName });
    else void downloadPng(svgs, { fileName });
  };
  return (
    <fieldset
      className={cn(
        "m-0 flex shrink-0 items-center gap-0.5 rounded-pill border-0 bg-surface-2 p-0.5",
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
          className="cursor-pointer rounded-pill px-2 py-1 font-semibold text-[11.5px] text-ink-3 outline-none hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-accent-ink"
        >
          {texts[kind]}
        </button>
      ))}
    </fieldset>
  );
}
