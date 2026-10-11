import { cn } from "../../utils/cn.js";

const SKELETON_BARS = [0.42, 0.66, 0.5, 0.82, 0.58, 0.74, 0.46, 0.9, 0.62, 0.7];

export interface ChartSkeletonProps {
  height: number;
  label: string;
  /** "bars" mimics columns, "line" a soft wave, "ring" a donut (for polar charts). */
  shape?: "bars" | "line" | "ring";
  className?: string;
}

/** Loading placeholder with the rough shape of the chart that is coming. */
export function ChartSkeleton({ height, label, shape = "bars", className }: ChartSkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className={cn("relative flex w-full animate-pulse flex-col gap-3", className)}
      style={{ height }}
    >
      <div className="flex gap-2">
        <span className="h-3 w-16 rounded-xs bg-surface-2" />
        <span className="h-3 w-12 rounded-xs bg-surface-2" />
      </div>
      {shape === "ring" ? (
        <div className="flex flex-1 items-center justify-center">
          <span
            className="aspect-square h-[78%] rounded-pill border-[18px] border-surface-2"
            aria-hidden="true"
          />
        </div>
      ) : shape === "line" ? (
        <svg
          aria-hidden="true"
          className="w-full flex-1"
          viewBox="0 0 100 40"
          preserveAspectRatio="none"
        >
          <path
            d="M0,30 C12,26 18,14 30,18 C42,22 48,8 60,10 C72,12 80,24 100,6 L100,40 L0,40 Z"
            className="fill-surface-2"
          />
        </svg>
      ) : (
        <div className="flex flex-1 items-end gap-[3%] border-b-divider px-[2%]">
          {SKELETON_BARS.map((ratio) => (
            <span
              key={ratio}
              className="flex-1 rounded-t-chip bg-surface-2"
              style={{ height: `${ratio * 100}%` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export interface ChartEmptyProps {
  height: number;
  label: string;
  className?: string;
}

/** Shown when there is nothing to plot: keeps the chart's footprint, says why. */
export function ChartEmpty({ height, label, className }: ChartEmptyProps) {
  return (
    <div
      className={cn(
        "flex w-full flex-col items-center justify-center gap-2 rounded-event bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_calc(25%-1px),var(--chart-grid)_calc(25%-1px),var(--chart-grid)_25%)]",
        className,
      )}
      style={{ height }}
    >
      <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" className="text-ink-3">
        <path
          d="M4 19h16M7 15v2M11 11v6M15 13v4M19 8v9"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
      <p className="m-0 font-semibold text-fs-130 text-ink-3">{label}</p>
    </div>
  );
}
