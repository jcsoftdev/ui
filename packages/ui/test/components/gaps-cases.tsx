import { renderToStaticMarkup } from "react-dom/server";
import { Kbd } from "../../src/atoms/kbd/kbd.js";
import { Spinner } from "../../src/atoms/spinner/spinner.js";
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
  kbd: () => renderToStaticMarkup(<Kbd className="extra">⌘K</Kbd>),
};
