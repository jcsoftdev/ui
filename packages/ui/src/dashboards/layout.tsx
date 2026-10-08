import type { Decorator } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { Card, CardBody, CardHeader } from "../containers/card/index.js";
import { cn } from "../utils/cn.js";

/** Vertical rhythm of a dashboard page. */
export function DashboardPage({ children }: { children: ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-4">{children}</div>;
}

/** Joined KPI tiles: two per row when narrow, four from 720 px of page width. */
export function KpiRow({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-card bg-line shadow-flat @min-[720px]/page:grid-cols-4">
      {children}
    </div>
  );
}

const gridClasses = {
  2: "grid-cols-1 @min-[720px]/page:grid-cols-2",
  3: "grid-cols-1 @min-[720px]/page:grid-cols-2 @min-[1180px]/page:grid-cols-3",
} as const;

/** Equal cards that stack under 720 px of page width. */
export function CardGrid({ columns = 2, children }: { columns?: 2 | 3; children: ReactNode }) {
  return <div className={cn("grid items-start gap-4", gridClasses[columns])}>{children}</div>;
}

export interface ChartCardProps {
  title: string;
  subtitle?: string;
  /** Slot at the end of the header (a chip, a button). */
  aside?: ReactNode;
  /** Fixed height of the body in px; the chart inside uses `height="fill"`. */
  height?: number;
  children: ReactNode;
}

function CardTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="min-w-0 flex-1">
      <h2 className="m-0 break-words font-semibold text-[14px] text-ink">{title}</h2>
      {subtitle ? <p className="m-0 break-words text-[12px] text-ink-3">{subtitle}</p> : null}
    </div>
  );
}

/** Card with a fixed-height body so `height="fill"` charts take exactly the space left. */
export function ChartCard({ title, subtitle, aside, height = 300, children }: ChartCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle title={title} subtitle={subtitle} />
        {aside}
      </CardHeader>
      <CardBody>
        <div className="min-w-0" style={{ height }}>
          {children}
        </div>
      </CardBody>
    </Card>
  );
}

/** Card whose body is a table or grid that scrolls inside its own wrapper. */
export function TableCard({ title, subtitle, aside, children }: Omit<ChartCardProps, "height">) {
  return (
    <Card>
      <CardHeader>
        <CardTitle title={title} subtitle={subtitle} />
        {aside}
      </CardHeader>
      <div className="min-w-0">{children}</div>
    </Card>
  );
}

/** Container-width frames for the `Narrow` (320) and `Tablet` (768) variants. */
export const narrowFrame: Decorator = (Story) => (
  <div className="@container/page w-[320px] max-w-full">
    <Story />
  </div>
);

export const tabletFrame: Decorator = (Story) => (
  <div className="@container/page w-[768px] max-w-full">
    <Story />
  </div>
);

export const NARROW_NOTE =
  "Container of 320 px: Cols collapse to one column, KPIs go two per row and every chart adapts to its card.";
export const TABLET_NOTE =
  "Container of 768 px: cards pair up and Cols stay in one column (they split from 940 px of container).";
