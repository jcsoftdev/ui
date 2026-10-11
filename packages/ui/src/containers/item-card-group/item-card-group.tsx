import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { ChevronRight } from "../../icons/index.js";
import type { ClassNames } from "../../utils/class-names.js";
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

export type ItemCardGroupPart =
  | "root"
  | "header"
  | "title"
  | "description"
  | "list"
  | "item"
  | "row"
  | "leading"
  | "text"
  | "itemTitle"
  | "itemDescription"
  | "trailing"
  | "chevron";

export interface ItemCardGroupProps extends Omit<ComponentPropsWithoutRef<"section">, "title"> {
  title?: ReactNode;
  description?: ReactNode;
  items: ItemCardGroupItem[];
  /** Id of the highlighted row. */
  selectedId?: string;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<ItemCardGroupPart>;
}

/** Rows grouped inside a single card (settings, clients, services), with an optional heading. */
export function ItemCardGroup({
  title,
  description,
  items,
  selectedId,
  className,
  classNames,
  ...props
}: ItemCardGroupProps) {
  return (
    <section
      {...props}
      className={cn(
        "@container/item-group flex min-w-0 flex-col gap-density-sm",
        classNames?.root,
        className,
      )}
    >
      {title || description ? (
        <header className={cn("flex min-w-0 flex-col px-1", classNames?.header)}>
          {title ? (
            <h3 className={cn("truncate text-card-title text-ink", classNames?.title)}>{title}</h3>
          ) : null}
          {description ? (
            <p className={cn("m-0 text-ink-3 text-meta", classNames?.description)}>{description}</p>
          ) : null}
        </header>
      ) : null}
      <ul
        className={cn(
          "m-0 flex list-none flex-col overflow-hidden rounded-card border-card surface-card p-0 shadow-card",
          classNames?.list,
        )}
      >
        {items.map((item, index) => {
          const selected = item.id === selectedId;
          const body = (
            <>
              {item.leading ? (
                <span
                  className={cn(
                    "flex shrink-0 items-center text-ink-2 [&_svg]:size-5",
                    classNames?.leading,
                  )}
                >
                  {item.leading}
                </span>
              ) : null}
              <span className={cn("flex min-w-0 flex-1 flex-col text-left", classNames?.text)}>
                <span className={cn("truncate text-row-title text-ink", classNames?.itemTitle)}>
                  {item.title}
                </span>
                {item.description ? (
                  <span
                    className={cn("truncate text-ink-3 text-meta", classNames?.itemDescription)}
                  >
                    {item.description}
                  </span>
                ) : null}
              </span>
              {item.trailing ? (
                <span
                  className={cn(
                    "flex shrink-0 items-center gap-density-sm text-ink-2 text-meta",
                    classNames?.trailing,
                  )}
                >
                  {item.trailing}
                </span>
              ) : null}
              {item.onSelect ? (
                <ChevronRight
                  className={cn("size-4 shrink-0 text-ink-3", classNames?.chevron)}
                  aria-hidden="true"
                />
              ) : null}
            </>
          );
          const rowClass = cn(
            "flex min-h-control w-full min-w-0 items-center gap-density px-control-x py-density-sm",
            index > 0 && "border-t-divider",
            selected && "bg-accent-soft shadow-selected",
            classNames?.row,
          );
          return (
            <li key={item.id} className={cn("min-w-0", classNames?.item)}>
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
