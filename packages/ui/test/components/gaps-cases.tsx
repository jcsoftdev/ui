import { renderToStaticMarkup } from "react-dom/server";
import { Kbd } from "../../src/atoms/kbd/kbd.js";
import { Spinner } from "../../src/atoms/spinner/spinner.js";
import { Banner } from "../../src/containers/banner/banner.js";
import { UiStringsProvider } from "../../src/i18n/index.js";

export const html = {
  spinnerDefault: () => renderToStaticMarkup(<Spinner />),
  spinnerEs: () =>
    renderToStaticMarkup(
      <UiStringsProvider locale="es">
        <Spinner />
      </UiStringsProvider>,
    ),
  spinnerOverride: () =>
    renderToStaticMarkup(
      <UiStringsProvider locale="es" strings={{ loading: "Un momento" }}>
        <Spinner />
      </UiStringsProvider>,
    ),
  spinnerLabel: () => renderToStaticMarkup(<Spinner label="Saving" size="lg" />),
  spinnerDecorative: () => renderToStaticMarkup(<Spinner label={false} />),
  spinnerPixels: () => renderToStaticMarkup(<Spinner size={40} style={{ color: "red" }} />),
  bannerSoft: () => renderToStaticMarkup(<Banner tone="warning">Careful</Banner>),
  bannerOutline: (tone: "info" | "success" | "warning" | "danger") =>
    renderToStaticMarkup(
      <Banner tone={tone} appearance="outline" title="Heads up">
        Careful
      </Banner>,
    ),
  kbd: () => renderToStaticMarkup(<Kbd className="extra">⌘K</Kbd>),
};
