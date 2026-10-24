import { type ComponentPropsWithoutRef, type ReactNode, useId } from "react";
import { cn } from "../../utils/cn.js";
import { Card, CardBody, CardHeader } from "../card/card.js";

export type DashboardPageProps = ComponentPropsWithoutRef<"div">;

/** Vertical rhythm of a dashboard page. Put it inside `Page` so the `page` container query applies. */
export function DashboardPage({ className, ...props }: DashboardPageProps) {
  return <div className={cn("flex min-w-0 flex-col gap-4", className)} {...props} />;
}

export interface KpiRowProps extends ComponentPropsWithoutRef<"div"> {
  /** Accessible name of the group of figures, e.g. "Key figures". */
  "aria-label"?: string;
}

/**
 * Joined KPI tiles: two per row when narrow, four from 720 px of `page` container width. It is a
 * named `group`, so give it an `aria-label` when the tiles are not introduced by a heading.
 */
export function KpiRow({ className, ...props }: KpiRowProps) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset would add form semantics and default chrome to a grid of figures
    <div
      role="group"
      className={cn(
        "grid grid-cols-2 gap-px overflow-hidden rounded-card border-card bg-line shadow-card @min-[720px]/page:grid-cols-4",
        className,
      )}
      {...props}
    />
  );
}

const gridClasses = {
  2: "grid-cols-1 @min-[720px]/page:grid-cols-2",
  3: "grid-cols-1 @min-[720px]/page:grid-cols-2 @min-[1180px]/page:grid-cols-3",
} as const;

export interface CardGridProps extends ComponentPropsWithoutRef<"div"> {
  /** Columns at the widest container: 2 (from 720 px) or 3 (2 from 720 px, 3 from 1180 px). Default 2. */
  columns?: 2 | 3;
}

/** Equal cards that stack under 720 px of `page` container width. */
export function CardGrid({ columns = 2, className, ...props }: CardGridProps) {
  return (
    <div className={cn("grid items-start gap-4", gridClasses[columns], className)} {...props} />
  );
}

export interface DashboardCardProps {
  title: string;
  subtitle?: string;
  /** Slot at the end of the header (a chip, a button). */
  aside?: ReactNode;
  /** Heading level of the title; the card is a named `region`. Default 2. */
  headingLevel?: 2 | 3 | 4;
  className?: string;
  children: ReactNode;
}

export interface ChartCardProps extends DashboardCardProps {
  /** Fixed height of the body in px; the chart inside uses `height="fill"`. Default 300. */
  height?: number;
}

function CardTitle({
  id,
  title,
  subtitle,
  level,
}: {
  id: string;
  title: string;
  subtitle: string | undefined;
  level: 2 | 3 | 4;
}) {
  const Heading = `h${level}` as const;
  return (
    <div className="min-w-0 flex-1">
      <Heading id={id} className="m-0 break-words font-semibold text-fs-140 text-ink">
        {title}
      </Heading>
      {subtitle ? <p className="m-0 break-words text-fs-120 text-ink-3">{subtitle}</p> : null}
    </div>
  );
}

/**
 * Card with a fixed-height body so `height="fill"` charts take exactly the space left. It is a
 * `region` named by its title.
 */
export function ChartCard({
  title,
  subtitle,
  aside,
  height = 300,
  headingLevel = 2,
  className,
  children,
}: ChartCardProps) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className={cn("min-w-0", className)}>
      <Card>
        <CardHeader>
          <CardTitle id={titleId} title={title} subtitle={subtitle} level={headingLevel} />
          {aside}
        </CardHeader>
        <CardBody>
          <div className="min-w-0" style={{ height }}>
            {children}
          </div>
        </CardBody>
      </Card>
    </section>
  );
}

/** Card whose body is a table or grid that scrolls inside its own wrapper. A `region` named by its title. */
export function TableCard({
  title,
  subtitle,
  aside,
  headingLevel = 2,
  className,
  children,
}: DashboardCardProps) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className={cn("min-w-0", className)}>
      <Card>
        <CardHeader>
          <CardTitle id={titleId} title={title} subtitle={subtitle} level={headingLevel} />
          {aside}
        </CardHeader>
        <div className="min-w-0">{children}</div>
      </Card>
    </section>
  );
}
