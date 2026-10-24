import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "../../utils/cn.js";

export interface FormSectionProps extends Omit<ComponentPropsWithoutRef<"section">, "title"> {
  title: ReactNode;
  description?: ReactNode;
  /** The fields; usually a `FormGrid`. */
  children: ReactNode;
}

/**
 * Titled block of a form: the title and description beside the fields from 640px of container
 * width, stacked above them in a narrower container (the wrapper is the size container).
 */
export function FormSection({
  title,
  description,
  children,
  className,
  ...props
}: FormSectionProps) {
  return (
    <section
      {...props}
      className={cn(
        "@container/form-section min-w-0 [&+&]:border-line [&+&]:border-t [&+&]:pt-6",
        className,
      )}
    >
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-x-8 gap-y-4 @min-[640px]/form-section:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <header className="flex min-w-0 flex-col gap-1">
          <h3 className="font-semibold text-fs-140 text-ink [overflow-wrap:anywhere]">{title}</h3>
          {description ? (
            <p className="text-fs-130 text-ink-3 [overflow-wrap:anywhere]">{description}</p>
          ) : null}
        </header>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}
