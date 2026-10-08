import { ChevronRight } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "../../utils/cn.js";

export interface ItemCardGroupItem {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  /** Icon, avatar or thumbnail at the start. */
  leading?: ReactNode;
  /** Value, chip or switch at the end. */
  trailing?: ReactNode;
  /** Makes the row a button; the chevron shows it is navigable. */
  onSelect?: () => void;
  disabled?: boolean;
}

export interface ItemCardGroupProps extends Omit<ComponentPropsWithoutRef<"section">, "title"> {
  title?: ReactNode;
  description?: ReactNode;
  items: ItemCardGroupItem[];
  /** Id of the highlighted row. */
  selectedId?: string;
}

/** Rows grouped inside a single card (settings, clients, services), with an optional heading. */
export function ItemCardGroup({
  title,
  description,
  items,
  selectedId,
  className,
  ...props
}: ItemCardGroupProps) {
  return (
    <section
      className={cn("@container/item-group flex min-w-0 flex-col gap-density-sm", className)}
      {...props}
    >
      {title || description ? (
        <header className="flex min-w-0 flex-col px-1">
          {title ? <h3 className="truncate text-card-title text-ink">{title}</h3> : null}
          {description ? <p className="m-0 text-ink-3 text-meta">{description}</p> : null}
        </header>
      ) : null}
      <ul className="m-0 flex list-none flex-col overflow-hidden rounded-card border-card surface-card p-0 shadow-card">
        {items.map((item, index) => {
          const selected = item.id === selectedId;
          const body = (
            <>
              {item.leading ? (
                <span className="flex shrink-0 items-center text-ink-2 [&_svg]:size-5">
                  {item.leading}
                </span>
              ) : null}
              <span className="flex min-w-0 flex-1 flex-col text-left">
                <span className="truncate text-row-title text-ink">{item.title}</span>
                {item.description ? (
                  <span className="truncate text-ink-3 text-meta">{item.description}</span>
                ) : null}
              </span>
              {item.trailing ? (
                <span className="flex shrink-0 items-center gap-density-sm text-ink-2 text-meta">
                  {item.trailing}
                </span>
              ) : null}
              {item.onSelect ? (
                <ChevronRight className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
              ) : null}
            </>
          );
          const rowClass = cn(
            "flex min-h-control w-full min-w-0 items-center gap-density px-control-x py-density-sm",
            index > 0 && "border-t-divider",
            selected && "bg-accent-soft shadow-selected",
          );
          return (
            <li key={item.id} className="min-w-0">
              {item.onSelect ? (
                <button
                  type="button"
                  disabled={item.disabled}
                  aria-current={selected ? "true" : undefined}
                  onClick={item.onSelect}
                  className={cn(
                    rowClass,
                    "pressable cursor-pointer text-left hover:bg-surface-2 focus-visible:focus-ring disabled:cursor-not-allowed disabled:opacity-50",
                  )}
                >
                  {body}
                </button>
              ) : (
                <div
                  aria-current={selected ? "true" : undefined}
                  className={cn(rowClass, item.disabled && "opacity-50")}
                >
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
