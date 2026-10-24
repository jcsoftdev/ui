"use client";

import {
  type ComponentPropsWithoutRef,
  type CSSProperties,
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useUiStrings } from "../../i18n/index.js";
import { ChevronLeft } from "../../icons/index.js";
import { cn } from "../../utils/cn.js";
import { composeHandlers } from "../../utils/compose.js";
import { useControllableState } from "../../utils/use-controllable-state.js";

interface ListDetailContextValue {
  value: string | null;
  select: (value: string | null) => void;
  label: string;
}

const ListDetailContext = createContext<ListDetailContextValue | null>(null);

function useListDetailContext(part: string): ListDetailContextValue {
  const context = useContext(ListDetailContext);
  if (!context) throw new Error(`\`${part}\` must be used within \`ListDetail\``);
  return context;
}

/** The selected item id (`null` while none) and a way to change it, for content inside the detail pane. */
export function useListDetail() {
  const { value, select } = useListDetailContext("useListDetail");
  return { value, select, isSelected: (candidate: string) => candidate === value };
}

/** List-to-detail width ratio when `listWidth` is not set: `1:1` (default), `1:2` or `1:3`. */
export type ListDetailRatio = "1:1" | "1:2" | "1:3";

const ratioClasses: Record<ListDetailRatio, string> = {
  "1:1": "@min-[641px]/list-detail:grid-cols-2",
  "1:2": "@min-[641px]/list-detail:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]",
  "1:3": "@min-[641px]/list-detail:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]",
};

const FIXED_LIST_COLUMNS =
  "@min-[641px]/list-detail:grid-cols-[minmax(0,var(--ld-list-width))_minmax(0,1fr)]";

function cssLength(value: number | string): string {
  return typeof value === "number" ? `${value}px` : value;
}

export interface ListDetailProps
  extends Omit<ComponentPropsWithoutRef<"div">, "defaultValue" | "onChange"> {
  /** Controlled selected item id; `null` means none (the single-pane view then shows the list). */
  value?: string | null | undefined;
  defaultValue?: string | null | undefined;
  /**
   * Called with the id the user chose. It is never called with `null`: going back to the list
   * calls `onBack` instead, so a handler that loads the selected record never sees "no record".
   */
  onValueChange?: ((value: string) => void) | undefined;
  /**
   * Called when the back action (or `select(null)` from `useListDetail`) clears the selection.
   * Uncontrolled, the list shows again on its own; controlled, set `value` to `null` here.
   */
  onBack?: (() => void) | undefined;
  /** Names the list of items. */
  "aria-label": string;
  /**
   * Fixed width of the list column beside the detail, from 641px of the component's own width: a
   * number is pixels, a string any CSS length (`"20rem"`). A rail of 280-360px reads better than
   * an even split for most catalogues. Wins over `ratio`.
   */
  listWidth?: number | string | undefined;
  /** Proportional split when `listWidth` is not set. Defaults to `"1:1"` (the original even split). */
  ratio?: ListDetailRatio | undefined;
  /**
   * `"flat"` (default) keeps the panes flush with a divider between them. `"card"` draws each pane
   * as a raised card with a gap between them.
   */
  surface?: "flat" | "card" | undefined;
  /**
   * Keeps the list column in view while the page scrolls and gives it its own scroll, from 641px
   * of the component's own width. The list header stays at the top of the column.
   */
  stickyList?: boolean | undefined;
  /** Distance the sticky list keeps from the top of its scroll container (number = pixels). Default `0`. */
  stickyOffset?: number | string | undefined;
  children: ReactNode;
}

/**
 * Master-detail: a list of items beside the detail of the selected one. Under 641px of its own
 * width it collapses to a single pane: the list until an item is chosen, then the detail with a
 * back action (focus follows the change). Panes render flush to the container's inline edges.
 */
export function ListDetail({
  value: valueProp,
  defaultValue = null,
  onValueChange,
  onBack,
  "aria-label": label,
  listWidth,
  ratio = "1:1",
  surface = "flat",
  stickyList = false,
  stickyOffset,
  className,
  style,
  children,
  ...props
}: ListDetailProps) {
  const [value, setValue] = useControllableState<string | null>({
    prop: valueProp,
    defaultProp: defaultValue,
    onChange: (next) => {
      if (next !== null) onValueChange?.(next);
    },
  });
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const select = useCallback(
    (next: string | null) => {
      setValue(next);
      if (next === null) onBackRef.current?.();
    },
    [setValue],
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const previous = useRef<string | null>(value);

  useEffect(() => {
    const before = previous.current;
    previous.current = value;
    const root = rootRef.current;
    if (before === value || !root) return;
    if (value === null && before !== null) {
      root.querySelector<HTMLElement>(`[data-list-detail-item="${CSS.escape(before)}"]`)?.focus();
      return;
    }
    const detail = root.querySelector<HTMLElement>('[data-list-detail-pane="detail"]');
    // Only when the detail replaced the list (single pane): beside the list, focus stays put.
    const back = detail?.querySelector<HTMLElement>("[data-list-detail-back]");
    if (detail && back && back.getClientRects().length > 0) detail.focus();
  }, [value]);

  const context = useMemo(() => ({ value, select, label }), [value, select, label]);

  return (
    <ListDetailContext.Provider value={context}>
      <div
        {...props}
        ref={rootRef}
        className={cn("@container/list-detail min-w-0", className)}
        style={
          {
            ...style,
            ...(listWidth !== undefined ? { "--ld-list-width": cssLength(listWidth) } : null),
            ...(stickyOffset !== undefined ? { "--ld-sticky-top": cssLength(stickyOffset) } : null),
          } as CSSProperties
        }
      >
        <div
          data-view={value === null ? "list" : "detail"}
          data-surface={surface}
          data-sticky-list={stickyList ? "" : undefined}
          className={cn(
            "group/ld grid grid-cols-1",
            surface === "flat" && "border-t-divider",
            listWidth !== undefined ? FIXED_LIST_COLUMNS : ratioClasses[ratio],
            surface === "card" && "@min-[641px]/list-detail:gap-4",
            "[&>*]:min-w-0",
          )}
        >
          {children}
        </div>
      </div>
    </ListDetailContext.Provider>
  );
}

export interface ListDetailListProps extends Omit<ComponentPropsWithoutRef<"ul">, "aria-label"> {
  /** Sits above the items and stays put while they scroll: a `ListDetailHeader` with search, filters and a count. */
  header?: ReactNode;
}

/**
 * The list column: an optional `header` above the item list. The `ul` is named by the
 * `ListDetail`'s `aria-label`; `className` and the other props go to it.
 */
export function ListDetailList({ header, className, ...props }: ListDetailListProps) {
  const { label } = useListDetailContext("ListDetailList");
  return (
    <div
      data-list-detail-pane="list"
      className={cn(
        "flex min-h-0 min-w-0 flex-col",
        "@min-[641px]/list-detail:border-r-divider",
        "group-data-[view=detail]/ld:@max-[640px]/list-detail:hidden",
        "group-data-[surface=card]/ld:overflow-hidden group-data-[surface=card]/ld:rounded-card group-data-[surface=card]/ld:border-card group-data-[surface=card]/ld:shadow-card group-data-[surface=card]/ld:surface-card group-data-[surface=card]/ld:@min-[641px]/list-detail:border-r-0",
        "group-data-[sticky-list]/ld:@min-[641px]/list-detail:sticky group-data-[sticky-list]/ld:@min-[641px]/list-detail:top-(--ld-sticky-top,0px) group-data-[sticky-list]/ld:@min-[641px]/list-detail:max-h-[calc(100dvh-var(--ld-sticky-top,0px))] group-data-[sticky-list]/ld:@min-[641px]/list-detail:self-start",
      )}
    >
      {header}
      <ul
        aria-label={label}
        className={cn(
          "m-0 flex min-h-0 list-none flex-col p-0",
          "group-data-[sticky-list]/ld:@min-[641px]/list-detail:overflow-y-auto",
          "group-data-[surface=card]/ld:p-2",
          className,
        )}
        {...props}
      />
    </div>
  );
}

export interface ListDetailHeaderProps extends ComponentPropsWithoutRef<"div"> {
  /** End slot showing how many items match, e.g. `12`. Announced politely when it changes. */
  count?: ReactNode;
}

/** Controls row of the list column: a search field, filter chips and a result count. */
export function ListDetailHeader({ count, className, children, ...props }: ListDetailHeaderProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-wrap items-center gap-2 border-b-divider py-2.5 group-data-[surface=card]/ld:px-3",
        className,
      )}
      {...props}
    >
      {children}
      {count !== undefined ? (
        <span aria-live="polite" className="ml-auto text-count text-ink-3">
          {count}
        </span>
      ) : null}
    </div>
  );
}

export interface ListDetailItemProps extends Omit<ComponentPropsWithoutRef<"button">, "value"> {
  value: string;
  /** End slot: a count, a status chip, a time. */
  trailing?: ReactNode;
}

export function ListDetailItem({
  value,
  trailing,
  className,
  children,
  onClick,
  ...props
}: ListDetailItemProps) {
  const { value: selected, select } = useListDetailContext("ListDetailItem");
  const isSelected = selected === value;
  return (
    <li>
      <button
        type="button"
        data-list-detail-item={value}
        aria-current={isSelected ? "true" : undefined}
        onClick={composeHandlers(onClick, () => select(value))}
        className={cn(
          "grid min-h-11 w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b-divider py-2.5 text-start hover:bg-surface-2 focus-visible:-outline-offset-2 focus-visible:focus-ring aria-[current=true]:bg-accent-soft",
          "group-data-[surface=card]/ld:rounded-button group-data-[surface=card]/ld:border-b-0 group-data-[surface=card]/ld:px-3",
          className,
        )}
        {...props}
      >
        <span className="min-w-0">{children}</span>
        {trailing !== undefined ? (
          <span className="min-w-0 justify-self-end">{trailing}</span>
        ) : null}
      </button>
    </li>
  );
}

export function ListDetailTitle({ className, ...props }: ComponentPropsWithoutRef<"span">) {
  return <span className={cn("block font-medium text-ink", className)} {...props} />;
}

export function ListDetailMeta({ className, ...props }: ComponentPropsWithoutRef<"span">) {
  return <span className={cn("block text-meta text-ink-3", className)} {...props} />;
}

interface DetailTitleValue {
  titleId: string;
  register: () => () => void;
}

const DetailTitleContext = createContext<DetailTitleValue | null>(null);

export interface ListDetailDetailProps extends ComponentPropsWithoutRef<"section"> {
  /** Label of the back action shown in the single-pane view. Defaults to the localized "Back to list". */
  backLabel?: string;
  /** Hides the back action (the consumer then provides its own way back). */
  hideBack?: boolean;
}

/** The detail pane. A labelled region named by its `ListDetailDetailHeader` title or an `aria-label`. */
export function ListDetailDetail({
  backLabel,
  hideBack = false,
  className,
  children,
  ...props
}: ListDetailDetailProps) {
  const strings = useUiStrings();
  const { select } = useListDetailContext("ListDetailDetail");
  const titleId = useId();
  const [titled, setTitled] = useState(0);
  const register = useCallback(() => {
    setTitled((count) => count + 1);
    return () => setTitled((count) => count - 1);
  }, []);
  const context = useMemo(() => ({ titleId, register }), [titleId, register]);
  return (
    <DetailTitleContext.Provider value={context}>
      <section
        data-list-detail-pane="detail"
        tabIndex={-1}
        aria-labelledby={titled > 0 && props["aria-label"] === undefined ? titleId : undefined}
        {...props}
        className={cn(
          "flex min-w-0 flex-col outline-none",
          "group-data-[view=list]/ld:@max-[640px]/list-detail:hidden",
          "group-data-[surface=card]/ld:rounded-card group-data-[surface=card]/ld:border-card group-data-[surface=card]/ld:px-card group-data-[surface=card]/ld:pb-card group-data-[surface=card]/ld:shadow-card group-data-[surface=card]/ld:surface-card",
          className,
        )}
      >
        {hideBack ? null : (
          <button
            type="button"
            data-list-detail-back=""
            onClick={() => select(null)}
            className={cn(
              "inline-flex min-h-11 cursor-pointer items-center gap-1 self-start text-control text-ink-2 hover:text-ink focus-visible:focus-ring",
              "@min-[641px]/list-detail:hidden",
            )}
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
            {backLabel ?? strings.backToList}
          </button>
        )}
        {children}
      </section>
    </DetailTitleContext.Provider>
  );
}

export interface ListDetailDetailHeaderProps
  extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}

export function ListDetailDetailHeader({
  title,
  description,
  actions,
  className,
  ...props
}: ListDetailDetailHeaderProps) {
  const detail = useContext(DetailTitleContext);
  const register = detail?.register;
  useLayoutEffect(() => register?.(), [register]);
  return (
    <div
      className={cn("flex flex-wrap items-start justify-between gap-3 pt-4 pb-3", className)}
      {...props}
    >
      <div className="min-w-0">
        <h3 id={detail?.titleId} className="m-0 font-semibold text-body text-ink">
          {title}
        </h3>
        {description !== undefined ? (
          <p className="m-0 mt-0.5 text-meta text-ink-3">{description}</p>
        ) : null}
      </div>
      {actions !== undefined ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export interface ListDetailEmptyProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  /** Decorative icon; hidden from screen readers. */
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Call to action under the text. */
  action?: ReactNode;
}

/**
 * Placeholder for the detail pane while nothing is selected ("Choose an item"). Render it inside
 * `ListDetailDetail`; it renders nothing once an item is selected, so it needs no condition.
 */
export function ListDetailEmpty({
  icon,
  title,
  description,
  action,
  className,
  ...props
}: ListDetailEmptyProps) {
  const { value } = useListDetailContext("ListDetailEmpty");
  if (value !== null) return null;
  return (
    <div
      className={cn(
        "flex min-h-64 flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center",
        className,
      )}
      {...props}
    >
      {icon !== undefined ? (
        <span aria-hidden="true" className="inline-flex text-ink-3 [&_svg]:size-8">
          {icon}
        </span>
      ) : null}
      <p className="m-0 font-semibold text-ink text-row-title">{title}</p>
      {description !== undefined ? (
        <p className="m-0 max-w-[44ch] text-ink-3 text-meta">{description}</p>
      ) : null}
      {action !== undefined ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
