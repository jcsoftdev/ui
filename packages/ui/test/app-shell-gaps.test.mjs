import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCases } from "./components/render.mjs";

const { html, units } = await loadCases("app-shell-gaps-cases.tsx");

test("StatusPill renders unchanged without an icon and hides a given icon from screen readers", () => {
  assert.doesNotMatch(html.statusPill(), /data-test-icon/);
  assert.match(html.statusPillIcon(), /<span aria-hidden="true"[^>]*><svg data-test-icon/);
});

test("an AppShell bottomBar is fixed to the bottom edge and hidden once the shell is wide", () => {
  const markup = html.shellWithBottomBar();
  assert.match(
    markup,
    /data-app-bottom-bar=""[^>]*class="fixed inset-x-0 bottom-0 z-40 @min-\[900px\]\/app:hidden"/,
  );
  assert.match(markup, /<nav aria-label="Main"/);
  assert.ok(markup.indexOf("<main>") < markup.indexOf("data-app-bottom-bar"));
});

test("an AppShell reserves the bottom bar through --app-bottom-bar only with a bottomBar", () => {
  assert.match(html.shellWithBottomBar(), /pb-\(--app-bottom-bar,0px\)/);
  assert.doesNotMatch(html.shellWithoutBottomBar(), /app-bottom-bar/);
});

test("SelectableCard is a single button with aria-pressed, aria-checked or neither", () => {
  assert.doesNotMatch(html.selectableButton(), /aria-pressed|role=/);
  assert.match(html.selectableToggle(true), /aria-pressed="true"/);
  assert.match(html.selectableToggle(false), /aria-pressed="false"/);
  const radio = html.selectableRadio(true);
  assert.match(radio, /role="radio"/);
  assert.match(radio, /aria-checked="true"/);
  assert.doesNotMatch(radio, /aria-pressed/);
  assert.equal(radio.match(/<button/g)?.length, 1);
});

test("a disabled SelectableCard stays focusable, announces its reason and is not natively disabled", () => {
  const markup = html.selectableDisabled();
  assert.match(markup, /aria-disabled="true"/);
  assert.doesNotMatch(markup, / disabled=""/);
  const [, id] = markup.match(/aria-describedby="([^"]+)"/) ?? [];
  assert.ok(id);
  assert.match(markup, new RegExp(`id="${id}"[^>]*>Closed today<`));
});

test("Kanban without cardActions keeps the single role=button card", () => {
  const markup = html.kanbanDefault();
  assert.match(markup, /role="button"/);
  assert.doesNotMatch(markup, /data-card-grip/);
});

test("Kanban with cardActions has a non-interactive card, a grip button and separate action buttons", () => {
  const markup = html.kanbanActions();
  assert.doesNotMatch(markup, /role="button"/);
  assert.match(markup, /<button[^>]*data-card-grip[^>]*/);
  assert.match(markup, /aria-label="Mover tarjeta: Order 1"/);
  assert.match(markup, /data-card-actions[^>]*><button type="button">Open a<\/button>/);
  assert.doesNotMatch(markup, /<div[^>]*data-card-id[^>]*tabindex/);
});

test("Drawer side=right keeps the side panel and side=bottom is a full-width sheet with the safe-area inset and a capped height", () => {
  assert.match(units.drawerSideClass("right"), /inset-y-0 right-0/);
  assert.match(units.drawerSideClass("right"), /w-\[min\(430px,100%\)\]/);
  const bottom = units.drawerSideClass("bottom");
  assert.match(bottom, /inset-x-0 bottom-0/);
  assert.match(bottom, /pb-\[env\(safe-area-inset-bottom\)\]/);
  assert.match(bottom, /max-h-\[min\(85dvh,100%\)\]/);
  assert.doesNotMatch(bottom, /right-0|inset-y-0/);
});

test("Progress keeps the accent indicator by default and tone recolours it without changing the semantics", () => {
  const base = html.progress();
  assert.match(base, /bg-accent/);
  assert.doesNotMatch(base, /data-tone/);
  for (const [tone, cls] of [
    ["neutral", "bg-ink-3"],
    ["success", "bg-success"],
    ["warning", "bg-warning"],
    ["danger", "bg-danger"],
    ["info", "bg-info"],
  ]) {
    const markup = html.progress({ tone });
    assert.match(markup, new RegExp(`class="[^"]*block h-full[^"]*${cls}`));
    assert.doesNotMatch(markup, /block h-full[^"]*bg-accent/);
    assert.match(markup, /role="progressbar"[^>]*aria-valuenow="40"/);
    assert.match(markup, new RegExp(`data-tone="${tone}"`));
  }
  assert.match(
    html.progress({ tone: "brand" }),
    /--tone-c:var\(--tone-brand\)[^>]*>[\s\S]*bg-\(--tone-c\)/,
  );
});

test("StatusPill is a plain span without a handler and a button with onSelect or onClick", () => {
  const plain = html.statusPill();
  assert.doesNotMatch(plain, /<button/);
  assert.match(plain, /^<span /);
  assert.match(plain, /sr-only[^>]*>Open</);
  assert.match(html.statusPillWith({ onSelect: () => {} }), /^<button type="button"/);
  assert.match(html.statusPillWith({ onClick: () => {} }), /^<button type="button"/);
  assert.doesNotMatch(html.statusPillWith({ onSelect: () => {} }), / disabled=""/);
});

test("StatusPill interactive forces the element either way", () => {
  assert.match(html.statusPillWith({ interactive: true }), /^<button type="button"/);
  assert.match(html.statusPillWith({ interactive: false, onSelect: () => {} }), /^<span /);
});

test("a collapsible SidebarGroup is a labelled toggle whose items are hidden while collapsed", () => {
  const open = html.sidebar({ collapsible: true });
  assert.equal(open.match(/<button[^>]*aria-expanded="true"/g)?.length, 2);
  assert.doesNotMatch(open, /hidden=""/);
  const collapsed = html.sidebar({ collapsible: true, collapsed: true });
  const toggle = collapsed.match(/<button[^>]*aria-expanded="false"[^>]*aria-controls="([^"]+)"/);
  assert.ok(toggle);
  assert.match(collapsed, new RegExp(`id="${toggle[1]}"[^>]*hidden=""`));
});

test("a collapsible group starts open when it holds the active page, collapsed otherwise", () => {
  const markup = html.sidebar({ collapsible: true, defaultCollapsed: true });
  const states = [...markup.matchAll(/aria-expanded="(true|false)"/g)].map((m) => m[1]);
  assert.deepEqual(states, ["true", "false"]);
});

test("a non-collapsible SidebarGroup renders no toggle", () => {
  const markup = html.sidebar();
  assert.doesNotMatch(markup, /aria-expanded/);
  assert.match(markup, /Operations/);
});

test("Toaster position accepts one value or one per viewport width, and offset drives the edge variables", () => {
  const single = units.toasterPlacement("bottom-center");
  assert.match(
    single.region,
    /bottom-\[var\(--toast-y,calc\(var\(--app-bottom-bar,0px\)_\+_1rem\)\)\]/,
  );
  assert.doesNotMatch(single.region, /min-\[/);
  assert.equal(single.list, "flex-col");
  assert.deepEqual(single.style, {});
  const responsive = units.toasterPlacement({
    base: "bottom-center",
    sm: "top-right",
    lg: "bottom-left",
  });
  assert.match(responsive.region, /min-\[640px\]:top-\[var\(--toast-y,1rem\)\]/);
  assert.match(responsive.region, /min-\[640px\]:right-\[var\(--toast-x,1rem\)\]/);
  assert.match(responsive.region, /min-\[1024px\]:left-\[var\(--toast-x,1rem\)\]/);
  assert.match(responsive.list, /min-\[640px\]:flex-col-reverse/);
  assert.match(responsive.list, /min-\[1024px\]:flex-col/);
  assert.deepEqual(units.toasterPlacement("top-left", 24).style, {
    "--toast-x": "24px",
    "--toast-y": "24px",
  });
  assert.deepEqual(
    units.toasterPlacement("top-left", { y: "calc(env(safe-area-inset-bottom) + 4rem)" }).style,
    { "--toast-y": "calc(env(safe-area-inset-bottom) + 4rem)" },
  );
});

test("KpiGroup stacks to one column by default and keeps two across with minColumns=2", () => {
  assert.match(html.kpiGroup(), /grid-cols-1/);
  const two = html.kpiGroup({ minColumns: 2 });
  assert.match(two, /<dl[^>]*class="[^"]*grid-cols-2/);
  assert.doesNotMatch(two, /<dl[^>]*class="[^"]*grid-cols-1/);
  assert.match(two, /@max-sm\/kpi-group:\[&amp;&gt;:last-child:nth-child\(odd\)\]:col-span-2/);
});

test("auto-fit KpiGroup never goes under two columns with minColumns=2", () => {
  const one = html.kpiGroup({ layout: "auto-fit" });
  assert.match(one, /minmax\(min\(100%, 150px\), 1fr\)/);
  const two = html.kpiGroup({ layout: "auto-fit", minColumns: 2 });
  assert.match(two, /minmax\(min\(150px, calc\(\(100% - var\(--gap-density\)\) \/ 2\)\), 1fr\)/);
});

test("Kanban draggable=false has no grip, no button role, no drag instructions and keeps the actions", () => {
  const plain = html.kanbanStatic(false);
  assert.doesNotMatch(
    plain,
    /role="button"|data-grip|data-card-grip|aria-pressed|cursor-grab|tabindex/,
  );
  assert.doesNotMatch(plain, /Presiona Espacio/);
  assert.match(plain, /data-card-id="a"/);
  const actions = html.kanbanStatic(true);
  assert.doesNotMatch(actions, /data-card-grip|data-grip|cursor-grab/);
  assert.match(actions, /data-card-actions[^>]*><button type="button">Open a<\/button>/);
});

test("Topbar renders its start slot before the breadcrumbs", () => {
  const markup = html.topbarStart();
  assert.match(markup, /<b>Venue<\/b>/);
  assert.ok(markup.indexOf("<b>Venue</b>") < markup.indexOf("<nav"));
});

test("ResponsiveList auto switches on its own container width, 42rem by default and configurable", () => {
  const markup = html.responsiveList();
  assert.match(markup, /@container\/responsive-list/);
  assert.match(markup, /hidden @min-\[42rem\]\/responsive-list:block/);
  assert.match(markup, /@min-\[42rem\]\/responsive-list:hidden/);
  assert.doesNotMatch(markup, /md:block|md:hidden/);
  const wide = html.responsiveList({ breakpoint: 960 });
  assert.match(wide, /hidden @min-\[960px\]\/responsive-list:block/);
  assert.doesNotMatch(wide, /42rem/);
});

test("ResponsiveList cardLabels=hidden keeps the field labels for screen readers only", () => {
  const shown = html.responsiveList({ layout: "cards" });
  assert.doesNotMatch(shown, /<dt[^>]*sr-only/);
  const hidden = html.responsiveList({ layout: "cards", cardLabels: "hidden" });
  assert.equal(hidden.match(/<dt[^>]*sr-only[^>]*>/g)?.length, 3);
  assert.match(hidden, /<dt[^>]*sr-only[^>]*>Code<\/dt>/);
});

test("SettingsLayout and its nav stack at 940 of the page container by default and follow the breakpoint", () => {
  const base = html.settingsLayout();
  assert.match(base, /@max-\[940px\]\/page:grid-cols-1/);
  assert.match(base, /@max-\[940px\]\/page:static/);
  const narrow = html.settingsLayout({ breakpoint: 720 });
  assert.match(narrow, /@max-\[720px\]\/page:grid-cols-1/);
  assert.match(narrow, /@max-\[720px\]\/page:flex-row/);
  assert.doesNotMatch(narrow, /940px/);
});

test("SettingsLayout breakpoint never keeps two columns, and container=self measures itself", () => {
  const never = html.settingsLayout({ breakpoint: "never" });
  assert.doesNotMatch(never, /@max-/);
  const own = html.settingsLayout({ container: "self", breakpoint: 1080 });
  assert.match(own, /^<div class="@container\/settings/);
  assert.match(own, /@max-\[1080px\]\/settings:grid-cols-1/);
  assert.match(own, /@max-\[1080px\]\/settings:overflow-x-auto/);
  assert.doesNotMatch(own, /\/page:/);
});

test("a SettingsLayoutNav outside a layout keeps the 940 default and takes its own breakpoint", () => {
  assert.match(html.settingsNav(), /@max-\[940px\]\/page:flex-row/);
  assert.match(html.settingsNav({ breakpoint: 1280 }), /@max-\[1280px\]\/page:flex-row/);
});

test("the ContextRail summary bar sits above the bottom bar the AppShell reserves", () => {
  assert.match(html.contextRailSheet(), /sticky bottom-\(--app-bottom-bar,0px\)/);
});

test("an uncontrolled SidebarGroup opens when an item becomes active later, a controlled one does not", () => {
  assert.equal(units.opensOnActivation(false, true, false), true);
  assert.equal(units.opensOnActivation(true, true, false), false);
  assert.equal(units.opensOnActivation(false, false, false), false);
  assert.equal(units.opensOnActivation(true, false, false), false);
  assert.equal(units.opensOnActivation(false, true, true), false);
});

test("StatusPill keeps its label visible by default and collapses it only with collapseLabel", () => {
  assert.doesNotMatch(html.statusPill(), /@max-\[700px\]:hidden/);
  assert.match(html.statusPillWith({ collapseLabel: true }), /@max-\[700px\]:hidden/);
});

test("StatusPill drops the dot when it has an icon unless dot is set, and the label still names the status", () => {
  assert.doesNotMatch(html.statusPill(), /hidden size-1\.75|size-1\.75[^"]*hidden/);
  const withIcon = html.statusPillIcon();
  assert.match(withIcon, /hidden[^"]*size-1\.75|size-1\.75[^"]*hidden/);
  assert.match(withIcon, /sr-only[^>]*>Open</);
  const forced = html.statusPillWith({ icon: "i", dot: true });
  assert.doesNotMatch(forced, /hidden[^"]*size-1\.75|size-1\.75[^"]*hidden/);
  assert.match(html.statusPillWith({ dot: false }), /hidden[^"]*size-1\.75|size-1\.75[^"]*hidden/);
});
