import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "../../utils/cn.js";

export function Table({ className, ...props }: ComponentPropsWithoutRef<"table">) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full border-collapse text-[13px]", className)} {...props} />
    </div>
  );
}

export function TableHead(props: ComponentPropsWithoutRef<"thead">) {
  return <thead {...props} />;
}

export function TableBody(props: ComponentPropsWithoutRef<"tbody">) {
  return <tbody {...props} />;
}

interface AlignProps {
  alignRight?: boolean;
}

export function TableHeaderCell({
  className,
  alignRight,
  ...props
}: ComponentPropsWithoutRef<"th"> & AlignProps) {
  return (
    <th
      className={cn(
        "whitespace-nowrap border-line border-b px-4 py-2.5 text-left font-[650] text-[11px] text-ink-3 uppercase tracking-[.07em]",
        alignRight && "text-right",
        className,
      )}
      {...props}
    />
  );
}

export function TableRow({ className, ...props }: ComponentPropsWithoutRef<"tr">) {
  return (
    <tr
      className={cn("border-line border-b last:border-b-0 hover:bg-surface-2", className)}
      {...props}
    />
  );
}

export function TableCell({
  className,
  alignRight,
  ...props
}: ComponentPropsWithoutRef<"td"> & AlignProps) {
  return (
    <td
      className={cn("px-4 py-[11px] align-middle", alignRight && "text-right", className)}
      {...props}
    />
  );
}

export interface TableLinkRowProps extends Omit<ComponentPropsWithoutRef<"tr">, "children"> {
  /** Row destination: rendered as a real `<a href>` in the first cell. */
  href: string;
  /** Content of the first cell, wrapped by the anchor. */
  primary: ReactNode;
  /** Additional `<td>` cells of the row. */
  children?: ReactNode;
}

/**
 * Fully navigable table row: the real link lives in the first cell and, via a
 * stretched link (positioned `<tr>` + anchor `::before` at `inset-0`), its
 * click area covers the whole row without duplicating the link per cell.
 */
export function TableLinkRow({ href, primary, children, className, ...props }: TableLinkRowProps) {
  return (
    <tr
      className={cn("relative border-line border-b last:border-b-0 hover:bg-surface-2", className)}
      {...props}
    >
      <td className="p-0 align-middle">
        <a
          href={href}
          className="block px-4 py-[11px] font-[650] text-ink no-underline before:absolute before:inset-0 before:content-['']"
        >
          {primary}
        </a>
      </td>
      {children}
    </tr>
  );
}
