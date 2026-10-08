"use client";

import { cn } from "../../utils/cn.js";

export interface ChartBreadcrumbItem {
  id: string;
  name: string;
}

export interface ChartBreadcrumbProps {
  /** Root first, current node last. */
  items: readonly ChartBreadcrumbItem[];
  onSelect: (id: string) => void;
  /** Accessible name of the navigation landmark. */
  label: string;
  className?: string;
}

/**
 * Drill-down path of a hierarchy chart. Every ancestor is a button that
 * zooms back out to it; the current node is marked with `aria-current`.
 */
export function ChartBreadcrumb({ items, onSelect, label, className }: ChartBreadcrumbProps) {
  return (
    <nav aria-label={label} className={cn("min-w-0", className)}>
      <ol className="m-0 flex list-none flex-wrap items-center gap-1 p-0 text-[12px]">
        {items.map((item, index) => {
          const current = index === items.length - 1;
          return (
            <li key={item.id} className="flex min-w-0 max-w-[12rem] items-center gap-1">
              {index > 0 ? (
                <svg
                  aria-hidden="true"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  className="text-ink-3"
                >
                  <path
                    d="m9 6 6 6-6 6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : null}
              {current ? (
                <span aria-current="page" className="truncate font-bold text-ink">
                  {item.name}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onSelect(item.id)}
                  className="cursor-pointer truncate rounded-xs border-0 bg-transparent p-0 font-semibold text-ink-3 outline-none hover:text-ink focus-visible:outline-2 focus-visible:outline-accent-ink focus-visible:outline-offset-2"
                >
                  {item.name}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
