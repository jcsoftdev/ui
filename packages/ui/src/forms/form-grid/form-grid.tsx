import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../../utils/cn.js";

export type FormGridColumns = 1 | 2 | 3;
export type FormGridSpan = 1 | 2 | 3 | "full";

export interface FormGridProps extends ComponentPropsWithoutRef<"div"> {
  /**
   * Largest column count, reached by container width: 2 columns from 620px, 3 from 900px
   * (the wrapper is the size container). `1` never splits. Default `2`.
   */
  columns?: FormGridColumns;
}

const COLUMNS: Record<FormGridColumns, string> = {
  1: "",
  2: "@min-[620px]/form-grid:grid-cols-[repeat(2,minmax(0,1fr))]",
  3: "@min-[620px]/form-grid:grid-cols-[repeat(2,minmax(0,1fr))] @min-[900px]/form-grid:grid-cols-[repeat(3,minmax(0,1fr))]",
};

/**
 * Grid for fields. One column in a narrow container, then up to `columns` by container width (the
 * wrapper is the size container; the grid keeps `className` and props).
 */
export function FormGrid({ columns = 2, className, ...props }: FormGridProps) {
  return (
    <div className="@container/form-grid min-w-0">
      <div
        data-columns={columns}
        className={cn(
          "group/form-grid grid grid-cols-[minmax(0,1fr)] gap-3.5",
          COLUMNS[columns],
          className,
        )}
        {...props}
      />
    </div>
  );
}

export interface FormGridItemProps extends ComponentPropsWithoutRef<"div"> {
  /**
   * Columns the item spans once the grid has them; it never adds a column the grid does not
   * have. `"full"` spans every column at any width. Default `1`.
   */
  span?: FormGridSpan;
}

const SPAN: Record<FormGridSpan, string> = {
  1: "",
  2: "group-data-[columns=2]/form-grid:@min-[620px]/form-grid:col-span-2 group-data-[columns=3]/form-grid:@min-[620px]/form-grid:col-span-2",
  3: "group-data-[columns=3]/form-grid:@min-[620px]/form-grid:col-span-2 group-data-[columns=3]/form-grid:@min-[900px]/form-grid:col-span-3",
  full: "col-span-full",
};

/** Grid cell that spans several columns; use it around a `Field` that needs the full row. */
export function FormGridItem({ span = 1, className, ...props }: FormGridItemProps) {
  return <div className={cn("min-w-0", SPAN[span], className)} {...props} />;
}
