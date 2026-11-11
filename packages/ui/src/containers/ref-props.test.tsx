import type { RefObject } from "react";
import type { ActionBarProps } from "./action-bar/action-bar.js";
import type { AsideHeaderProps, AsideProps } from "./aside/aside.js";
import type { BannerProps } from "./banner/banner.js";
import type { CardHeaderProps, CardRootProps } from "./card/card.js";
import type { CarouselProps } from "./carousel/carousel.js";
import type { ColsProps, ColsStackProps } from "./cols/cols.js";
import type { CommentProps } from "./comment/comment.js";
import type { CardGridProps, DashboardPageProps, KpiRowProps } from "./dashboard/dashboard.js";
import type { DescriptionListProps } from "./description-list/description-list.js";
import type { DetailHeaderProps } from "./detail-header/detail-header.js";
import type { FactsProps } from "./facts/facts.js";
import type { FeedEventProps, FeedProps } from "./feed/feed.js";
import type { FilterBarProps } from "./filter-bar/filter-bar.js";
import type { GenericRowProps } from "./generic-row/generic-row.js";
import type { GridProps } from "./grid/grid.js";
import type { HighlightLineProps } from "./highlight-line/highlight-line.js";
import type { ItemCardGroupProps } from "./item-card-group/item-card-group.js";
import type { KpiLabelProps, KpiProps } from "./kpi/kpi.js";
import type { KpiGroupProps } from "./kpi-group/kpi-group.js";
import type { ListDetailItemProps, ListDetailProps } from "./list-detail/list-detail.js";
import type { NoteProps } from "./note/note.js";
import type { PageProps } from "./page/page.js";
import type { PageHeaderBackProps } from "./page-header/back.js";
import type { PageHeaderProps } from "./page-header/page-header.js";
import type { CursorPaginationProps } from "./pagination/cursor-pagination.js";
import type { PaginationProps } from "./pagination/pagination.js";
import type {
  ResizableHandleProps,
  ResizablePanelGroupProps,
  ResizablePanelProps,
} from "./resizable/resizable.js";
import type { RowActionsProps } from "./row-actions/row-actions.js";
import type { SectionProps } from "./section/section.js";
import type {
  SettingsLayoutNavItemProps,
  SettingsLayoutProps,
} from "./settings-layout/settings-layout.js";
import type { SettingsRowProps } from "./settings-row/settings-row.js";
import type { ShortcutsProps } from "./shortcuts/shortcuts.js";
import type { StackProps } from "./stack/stack.js";
import type { TableLinkRowProps, TableProps, TableRowProps } from "./table/table.js";
import type { TimelineItemProps, TimelineProps } from "./timeline/timeline.js";
import type { ToolbarProps } from "./toolbar/toolbar.js";

type RefAccepted<P, E extends Element> =
  RefObject<E | null> extends NonNullable<P extends { ref?: infer R } ? R : never> ? true : false;

type Assert<T extends true> = T;

export type RefPropsChecked = [
  Assert<RefAccepted<ActionBarProps, HTMLDivElement>>,
  Assert<RefAccepted<AsideProps, HTMLElement>>,
  Assert<RefAccepted<AsideHeaderProps, HTMLDivElement>>,
  Assert<RefAccepted<BannerProps, HTMLDivElement>>,
  Assert<RefAccepted<CardRootProps, HTMLDivElement>>,
  Assert<RefAccepted<CardHeaderProps, HTMLDivElement>>,
  Assert<RefAccepted<CarouselProps, HTMLElement>>,
  Assert<RefAccepted<ColsProps, HTMLDivElement>>,
  Assert<RefAccepted<ColsStackProps, HTMLDivElement>>,
  Assert<RefAccepted<CommentProps, HTMLDivElement>>,
  Assert<RefAccepted<DashboardPageProps, HTMLDivElement>>,
  Assert<RefAccepted<KpiRowProps, HTMLDivElement>>,
  Assert<RefAccepted<CardGridProps, HTMLDivElement>>,
  Assert<RefAccepted<DescriptionListProps, HTMLDListElement>>,
  Assert<RefAccepted<DetailHeaderProps, HTMLElement>>,
  Assert<RefAccepted<FactsProps, HTMLDListElement>>,
  Assert<RefAccepted<FeedProps, HTMLOListElement>>,
  Assert<RefAccepted<FeedEventProps, HTMLLIElement>>,
  Assert<RefAccepted<FilterBarProps, HTMLDivElement>>,
  Assert<RefAccepted<GenericRowProps, HTMLDivElement>>,
  Assert<RefAccepted<GridProps, HTMLDivElement>>,
  Assert<RefAccepted<HighlightLineProps, HTMLParagraphElement>>,
  Assert<RefAccepted<ItemCardGroupProps, HTMLElement>>,
  Assert<RefAccepted<KpiGroupProps, HTMLDListElement>>,
  Assert<RefAccepted<KpiProps, HTMLDivElement>>,
  Assert<RefAccepted<KpiLabelProps, HTMLSpanElement>>,
  Assert<RefAccepted<ListDetailProps, HTMLDivElement>>,
  Assert<RefAccepted<ListDetailItemProps, HTMLButtonElement>>,
  Assert<RefAccepted<NoteProps, HTMLParagraphElement>>,
  Assert<RefAccepted<PageHeaderProps, HTMLElement>>,
  Assert<RefAccepted<PageHeaderBackProps, HTMLAnchorElement>>,
  Assert<RefAccepted<PageProps, HTMLDivElement>>,
  Assert<RefAccepted<PaginationProps, HTMLElement>>,
  Assert<RefAccepted<CursorPaginationProps, HTMLElement>>,
  Assert<RefAccepted<ResizablePanelProps, HTMLDivElement>>,
  Assert<RefAccepted<ResizableHandleProps, HTMLDivElement>>,
  Assert<RefAccepted<ResizablePanelGroupProps, HTMLDivElement>>,
  Assert<RefAccepted<RowActionsProps, HTMLSpanElement>>,
  Assert<RefAccepted<SectionProps, HTMLElement>>,
  Assert<RefAccepted<SettingsLayoutProps, HTMLDivElement>>,
  Assert<RefAccepted<SettingsLayoutNavItemProps, HTMLButtonElement>>,
  Assert<RefAccepted<SettingsRowProps, HTMLDivElement>>,
  Assert<RefAccepted<ShortcutsProps, HTMLUListElement>>,
  Assert<RefAccepted<StackProps, HTMLDivElement>>,
  Assert<RefAccepted<TableProps, HTMLTableElement>>,
  Assert<RefAccepted<TableRowProps, HTMLTableRowElement>>,
  Assert<RefAccepted<TableLinkRowProps, HTMLTableRowElement>>,
  Assert<RefAccepted<TimelineProps, HTMLOListElement>>,
  Assert<RefAccepted<TimelineItemProps, HTMLLIElement>>,
  Assert<RefAccepted<ToolbarProps, HTMLDivElement>>,
];

export const intentProps = {
  card: { intent: "probe", intentKey: "k1" } satisfies Pick<CardRootProps, "intent" | "intentKey">,
  feedEvent: { intent: "probe", intentKey: "k1" } satisfies Pick<
    FeedEventProps,
    "intent" | "intentKey"
  >,
  genericRow: { intent: "probe", intentKey: "k1" } satisfies Pick<
    GenericRowProps,
    "intent" | "intentKey"
  >,
  listDetailItem: { intent: "probe", intentKey: "k1" } satisfies Pick<
    ListDetailItemProps,
    "intent" | "intentKey"
  >,
  rowActions: { intent: "probe", intentKey: "k1" } satisfies Pick<
    RowActionsProps,
    "intent" | "intentKey"
  >,
  section: { intent: "probe", intentKey: "k1" } satisfies Pick<
    SectionProps,
    "intent" | "intentKey"
  >,
  settingsLayoutNavItem: { intent: "probe", intentKey: "k1" } satisfies Pick<
    SettingsLayoutNavItemProps,
    "intent" | "intentKey"
  >,
  settingsRow: { intent: "probe", intentKey: "k1" } satisfies Pick<
    SettingsRowProps,
    "intent" | "intentKey"
  >,
  tableRow: { intent: "probe", intentKey: "k1" } satisfies Pick<
    TableRowProps,
    "intent" | "intentKey"
  >,
  tableLinkRow: { intent: "probe", intentKey: "k1" } satisfies Pick<
    TableLinkRowProps,
    "intent" | "intentKey"
  >,
  timelineItem: { intent: "probe", intentKey: "k1" } satisfies Pick<
    TimelineItemProps,
    "intent" | "intentKey"
  >,
};
