import { renderToStaticMarkup } from "react-dom/server";
import { UiStringsProvider } from "../../src/i18n/index.js";
import { Breadcrumbs } from "../../src/navigation/breadcrumbs/breadcrumbs.js";
import { LiveStatusBar } from "../../src/states/live-status-bar/live-status-bar.js";
import { CopyField } from "../../src/forms/copy-field/copy-field.js";
export { copyText } from "../../src/forms/copy-field/copy.js";
import { BottomNav } from "../../src/shell/bottom-nav/bottom-nav.js";
export { splitBottomNavItems } from "../../src/shell/bottom-nav/split.js";
import { AppShell, createAppShellStore, useAppShell } from "../../src/shell/app-shell/app-shell.js";
export { createAppShellStore };
import { Topbar } from "../../src/shell/topbar/topbar.js";
import { OfflineBanner } from "../../src/states/offline-banner/offline-banner.js";
import { Checkbox } from "../../src/atoms/checkbox/checkbox.js";
export { nextSegmentedValue } from "../../src/navigation/segmented/model.js";
import { Form, FormError, FormStatus } from "../../src/forms/form/form.js";
import { Grid } from "../../src/containers/grid/grid.js";

export const html = {
  gridFluid: () => renderToStaticMarkup(<Grid minColumnWidth="12rem" />),
  gridFixed: () => renderToStaticMarkup(<Grid columns={3} />),
  formError: (message) => renderToStaticMarkup(<FormError message={message} />),
  formStatus: (message) => renderToStaticMarkup(<FormStatus message={message} />),
  form: () => renderToStaticMarkup(<Form action="/save" className="extra" />),
  breadcrumbs: () =>
    renderToStaticMarkup(
      <Breadcrumbs
        items={[{ label: "Home", href: "/" }, { label: "Agenda", href: "/agenda" }, { label: "Today" }]}
      />,
    ),
  breadcrumbsEs: () =>
    renderToStaticMarkup(
      <UiStringsProvider locale="es">
        <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Hoy" }]} />
      </UiStringsProvider>,
    ),
  breadcrumbsCustom: () =>
    renderToStaticMarkup(
      <Breadcrumbs
        aria-label="Trail"
        items={[{ label: "Home", href: "/" }, { label: "Today" }]}
        renderLink={({ href, className, children }) => (
          <span data-router-link={href} className={className}>
            {children}
          </span>
        )}
      />,
    ),
  liveBar: (status, labels) =>
    renderToStaticMarkup(
      <LiveStatusBar status={status} labels={labels}>
        <b>3 waiting</b>
      </LiveStatusBar>,
    ),
  liveBarEs: () =>
    renderToStaticMarkup(
      <UiStringsProvider locale="es">
        <LiveStatusBar status="offline" />
      </UiStringsProvider>,
    ),
  copyField: () => renderToStaticMarkup(<CopyField label="Webhook URL" value="https://x.test/hook" />),
  copyFieldEs: () =>
    renderToStaticMarkup(
      <UiStringsProvider locale="es">
        <CopyField label="Enlace" value="abc" />
      </UiStringsProvider>,
    ),
  bottomNav: (count, activeIndex) =>
    renderToStaticMarkup(
      <BottomNav
        ariaLabel="Sections"
        items={Array.from({ length: count }, (_, index) => ({
          id: `i${index}`,
          label: `Item ${index}`,
          href: `/${index}`,
          active: index === activeIndex,
        }))}
      />,
    ),
  appShellReader: () => {
    function Reader() {
      return <i>{String(useAppShell()?.compact)}</i>;
    }
    return renderToStaticMarkup(
      <AppShell>
        <Reader />
      </AppShell>,
    );
  },
  appShellOutside: () => {
    function Reader() {
      return <i>{String(useAppShell())}</i>;
    }
    return renderToStaticMarkup(<Reader />);
  },
  topbarNoSearch: () =>
    renderToStaticMarkup(<Topbar breadcrumbs={["Home", "Agenda"]} breadcrumbsLabel="Trail" />),
  topbarSearch: () =>
    renderToStaticMarkup(
      <Topbar
        breadcrumbs={["Home"]}
        breadcrumbsLabel="Trail"
        onSearch={() => {}}
        searchLabel="Search"
        searchPlaceholder="Search anything"
      />,
    ),
  offlineAction: () =>
    renderToStaticMarkup(
      <OfflineBanner message="Offline" queuedChanges={2} action={<button type="button">Retry</button>} />,
    ),
  offlineActionOnly: () =>
    renderToStaticMarkup(<OfflineBanner message="Offline" action={<button type="button">Retry</button>} />),
  offlinePlain: () => renderToStaticMarkup(<OfflineBanner message="Offline" />),
  checkboxLabel: () => renderToStaticMarkup(<Checkbox label="Remember me" />),
  checkboxLabelId: () => renderToStaticMarkup(<Checkbox label="Remember me" id="remember" disabled />),
  checkboxBare: () => renderToStaticMarkup(<Checkbox aria-label="Remember me" />),
};
