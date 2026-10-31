import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StatusPill } from "../../src/atoms/status-pill/status-pill.js";
import { AppShell } from "../../src/shell/app-shell/app-shell.js";
import { SelectableCard } from "../../src/containers/selectable-card/selectable-card.js";
import { Kanban } from "../../src/containers/kanban/kanban.js";
import { Cols } from "../../src/containers/cols/cols.js";
import { ContextRail, isRailCollapsed } from "../../src/containers/context-rail/context-rail.js";
import { ChatThread, type ChatThreadItem } from "../../src/containers/chat-thread/chat-thread.js";
import { Progress } from "../../src/atoms/progress/progress.js";
import { opensOnActivation, Sidebar, type SidebarGroup } from "../../src/shell/sidebar/sidebar.js";
import { SettingsLayout, SettingsLayoutNav } from "../../src/containers/settings-layout/settings-layout.js";
import { drawerSideClass } from "../../src/overlays/drawer/drawer.js";
import { toasterPlacement } from "../../src/overlays/toaster/toaster.js";
import { BottomNav } from "../../src/shell/bottom-nav/bottom-nav.js";
import { ResponsiveList } from "../../src/containers/responsive-list/responsive-list.js";
import { Topbar } from "../../src/shell/topbar/topbar.js";
import { KpiGroup } from "../../src/containers/kpi-group/kpi-group.js";

const tabs = [
  { id: "orders", label: "Orders", href: "/orders", icon: <i data-icon />, active: true, badge: 3, badgeLabel: "new" },
  { id: "tables", label: "Tables", href: "/tables", icon: <i data-icon /> },
];

const board = [{ id: "todo", title: "To do", cards: [{ id: "a", title: "Order 1" }] }];

const orderRows = [
  { id: "a1", name: "Marco" },
  { id: "b2", name: "Lucía" },
  { id: "c3", name: "Diego" },
];
const orderColumns = [{ key: "name", header: "Customer", cell: (row: { name: string }) => row.name }];
const selectableList = (selectedKey: string | null, withActions = false) => (
  <ResponsiveList
    caption="Orders"
    layout="cards"
    items={orderRows}
    columns={orderColumns}
    rowKey={(row) => row.id}
    selectedKey={selectedKey}
    onSelect={() => {}}
    renderActions={withActions ? (row) => <button type="button">Open {row.id}</button> : undefined}
  />
);

const thread: ChatThreadItem[] = [
  { id: "m1", author: "customer", name: "Rosa", at: "2026-10-28T20:02:00Z", content: "Hola" },
  { id: "m2", author: "bot", at: "2026-10-28T20:03:00Z", content: "Buenas", status: "read" },
  { id: "n1", kind: "note", at: "2026-10-29T14:40:00Z", content: "El cliente pidió hablar con una persona" },
  { id: "m3", author: "staff", name: "Ana", at: "2026-10-29T14:44:00Z", content: "Te ayudo", status: "failed" },
  { id: "m4", author: "customer", at: "2026-10-29T14:45:00Z", content: "Gracias", status: "read" },
];
const chat = (extra: Partial<ComponentProps<typeof ChatThread>> = {}) =>
  renderToStaticMarkup(
    <ChatThread
      items={thread}
      now="2026-10-29T15:00:00Z"
      locale="en"
      timeZone="UTC"
      composer={<textarea aria-label="Message" />}
      {...extra}
    />,
  );

const navGroups = (extra: Partial<SidebarGroup> = {}): SidebarGroup[] => [
  {
    id: "ops",
    label: "Operations",
    items: [{ id: "home", label: "Home", href: "/", active: true }],
    ...extra,
  },
  {
    id: "biz",
    label: "Business",
    items: [{ id: "menu", label: "Menu", href: "/menu" }],
    ...extra,
  },
];

export const units = { drawerSideClass, toasterPlacement, isRailCollapsed, opensOnActivation };

export const html = {
  progress: (props: Partial<ComponentProps<typeof Progress>> = {}) =>
    renderToStaticMarkup(<Progress value={40} aria-label="Goal" {...props} />),
  sidebar: (extra: Partial<SidebarGroup> = {}) =>
    renderToStaticMarkup(<Sidebar groups={navGroups(extra)} ariaLabel="Main" />),
  settingsLayout: (props: Partial<ComponentProps<typeof SettingsLayout>> = {}) =>
    renderToStaticMarkup(
      <SettingsLayout {...props}>
        <SettingsLayoutNav>
          <button type="button">A</button>
        </SettingsLayoutNav>
        <div />
      </SettingsLayout>,
    ),
  settingsNav: (props: Partial<ComponentProps<typeof SettingsLayoutNav>> = {}) =>
    renderToStaticMarkup(<SettingsLayoutNav {...props} />),
  responsiveList: (props: Partial<ComponentProps<typeof ResponsiveList<(typeof orderRows)[number]>>> = {}) =>
    renderToStaticMarkup(
      <ResponsiveList
        caption="Orders"
        items={orderRows}
        columns={[...orderColumns, { key: "id", header: "Code", cell: (row: { id: string }) => row.id }]}
        rowKey={(row) => row.id}
        {...props}
      />,
    ),
  statusPillWith: (props: Partial<ComponentProps<typeof StatusPill>>) =>
    renderToStaticMarkup(<StatusPill status="success" label="Open" {...props} />),
  topbarStart: () => renderToStaticMarkup(<Topbar start={<b>Venue</b>} breadcrumbs={["Home", "Orders"]} />),
  kpiGroup: (props: Partial<ComponentProps<typeof KpiGroup>> = {}) =>
    renderToStaticMarkup(
      <KpiGroup
        animate={false}
        items={[
          { id: "a", label: "Orders", value: 1 },
          { id: "b", label: "Sales", value: 2 },
          { id: "c", label: "Tips", value: 3 },
        ]}
        {...props}
      />,
    ),
  kanbanStatic: (withActions: boolean) =>
    renderToStaticMarkup(
      <Kanban
        defaultColumns={board}
        draggable={false}
        cardActions={withActions ? (card) => <button type="button">Open {card.id}</button> : undefined}
      />,
    ),
  colsThirds: () => renderToStaticMarkup(<Cols variant="thirds"><i /><i /><i /></Cols>),
  colsBase: () => renderToStaticMarkup(<Cols><i /><i /></Cols>),
  selectableList: (selectedKey: string | null, withActions?: boolean) =>
    renderToStaticMarkup(selectableList(selectedKey, withActions)),
  selectableGrid: (selectedKey: string | null) =>
    renderToStaticMarkup(
      <ResponsiveList
        caption="Orders"
        items={orderRows}
        columns={orderColumns}
        rowKey={(row) => row.id}
        selectedKey={selectedKey}
        onSelect={() => {}}
      />,
    ),
  plainList: () => renderToStaticMarkup(
    <ResponsiveList caption="Orders" items={orderRows} columns={orderColumns} rowKey={(row) => row.id} />,
  ),
  cardsOnly: () => renderToStaticMarkup(
    <ResponsiveList caption="Orders" layout="cards" items={orderRows} columns={orderColumns} rowKey={(row) => row.id} />,
  ),
  contextRail: (props: Partial<ComponentProps<typeof ContextRail>> = {}) =>
    renderToStaticMarkup(
      <ContextRail rail={<p>Cart</p>} railLabel="Order" {...props}>
        <p>Dishes</p>
      </ContextRail>,
    ),
  chat,
  chatEmpty: () => chat({ items: [], empty: <p>No messages</p> }),
  contextRailSheet: () =>
    renderToStaticMarkup(
      <ContextRail rail={<p>Cart</p>} collapse="sheet" summary={<b>Total</b>} sheetLabel="View order">
        <p>Dishes</p>
      </ContextRail>,
    ),
  kanbanGrid: () => renderToStaticMarkup(<Kanban defaultColumns={board} cardGrid />),
  statusPill: () => renderToStaticMarkup(<StatusPill status="success" label="Open" />),
  statusPillIcon: () =>
    renderToStaticMarkup(<StatusPill status="success" label="Open" icon={<svg data-test-icon />} />),
  shellWithBottomBar: () =>
    renderToStaticMarkup(
      <AppShell bottomBar={<BottomNav ariaLabel="Main" items={tabs} />}>
        <main>Page</main>
      </AppShell>,
    ),
  shellWithoutBottomBar: () =>
    renderToStaticMarkup(
      <AppShell>
        <main>Page</main>
      </AppShell>,
    ),
  selectableButton: () => renderToStaticMarkup(<SelectableCard onClick={() => {}}>Delivery</SelectableCard>),
  selectableToggle: (selected: boolean) =>
    renderToStaticMarkup(<SelectableCard selected={selected}>Delivery</SelectableCard>),
  selectableRadio: (selected: boolean) =>
    renderToStaticMarkup(
      <SelectableCard selected={selected} semantics="radio">
        Delivery
      </SelectableCard>,
    ),
  selectableDisabled: () =>
    renderToStaticMarkup(
      <SelectableCard selected={false} disabled disabledReason="Closed today">
        Delivery
      </SelectableCard>,
    ),
  kanbanDefault: () => renderToStaticMarkup(<Kanban defaultColumns={board} />),
  kanbanActions: () =>
    renderToStaticMarkup(
      <Kanban
        defaultColumns={board}
        cardActions={(card) => <button type="button">Open {card.id}</button>}
      />,
    ),
};
