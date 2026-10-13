import { renderToStaticMarkup } from "react-dom/server";
import { UiStringsProvider } from "../../src/i18n/index.js";
import { Breadcrumbs } from "../../src/navigation/breadcrumbs/breadcrumbs.js";
import { LiveStatusBar } from "../../src/states/live-status-bar/live-status-bar.js";
import { CopyField } from "../../src/forms/copy-field/copy-field.js";
export { copyText } from "../../src/forms/copy-field/copy.js";
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
};
