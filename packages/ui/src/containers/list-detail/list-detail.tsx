"use client";

import {
  type ComponentPropsWithoutRef,
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

export interface ListDetailProps
  extends Omit<ComponentPropsWithoutRef<"div">, "defaultValue" | "onChange"> {
  /** Controlled selected item id; `null` means none (the single-pane view then shows the list). */
  value?: string | null | undefined;
  defaultValue?: string | null | undefined;
  /** Called with the new id, or `null` from the back action. */
  onValueChange?: ((value: string | null) => void) | undefined;
  /** Names the list of items. */
  "aria-label": string;
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
  "aria-label": label,
  className,
  children,
  ...props
}: ListDetailProps) {
  const [value, setValue] = useControllableState<string | null>({
    prop: valueProp,
    defaultProp: defaultValue,
    onChange: onValueChange,
  });
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

  const context = useMemo(() => ({ value, select: setValue, label }), [value, setValue, label]);

  return (
    <ListDetailContext.Provider value={context}>
      <div {...props} ref={rootRef} className={cn("@container/list-detail min-w-0", className)}>
        <div
          data-view={value === null ? "list" : "detail"}
          className={cn(
            "group/ld grid grid-cols-1 border-t-divider",
            "@min-[641px]/list-detail:grid-cols-2",
            "[&>*]:min-w-0",
          )}
        >
          {children}
        </div>
      </div>
    </ListDetailContext.Provider>
  );
}

export type ListDetailListProps = Omit<ComponentPropsWithoutRef<"ul">, "aria-label">;

export function ListDetailList({ className, ...props }: ListDetailListProps) {
  const { label } = useListDetailContext("ListDetailList");
  return (
    <ul
      data-list-detail-pane="list"
      aria-label={label}
      className={cn(
        "m-0 flex list-none flex-col p-0",
        "@min-[641px]/list-detail:border-r-divider",
        "group-data-[view=detail]/ld:@max-[640px]/list-detail:hidden",
        className,
      )}
      {...props}
    />
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
