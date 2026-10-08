import { forwardRef } from "react";

export interface SparkProps {
  /** Values to plot. */
  data: ReadonlyArray<number | null>;
  /** Stroke width in px. */
  width?: number;
}

/** Tiny inline trend line. */
export const Spark = forwardRef<SVGSVGElement, SparkProps>(function Spark({ data, width = 2 }, ref) {
  return (
    <svg ref={ref} role="img" aria-label={`${data.length} values`} strokeWidth={width}>
      <path d="M0 0" />
    </svg>
  );
});
