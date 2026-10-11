import { renderToStaticMarkup } from "react-dom/server";
import { Skeleton } from "../../src/states/skeleton/skeleton.js";
import { UiStringsProvider } from "../../src/i18n/index.js";

export const html = {
  skeletonDefault: () => renderToStaticMarkup(<Skeleton />),
  skeletonEs: () =>
    renderToStaticMarkup(
      <UiStringsProvider locale="es">
        <Skeleton />
      </UiStringsProvider>,
    ),
  skeletonOverride: () =>
    renderToStaticMarkup(
      <UiStringsProvider locale="es" strings={{ loading: "Un momento" }}>
        <Skeleton />
      </UiStringsProvider>,
    ),
  skeletonProp: () =>
    renderToStaticMarkup(
      <UiStringsProvider locale="es">
        <Skeleton label="Buscando" />
      </UiStringsProvider>,
    ),
  skeletonNested: () =>
    renderToStaticMarkup(
      <UiStringsProvider locale="es">
        <UiStringsProvider strings={{ loading: "Espera" }}>
          <Skeleton />
        </UiStringsProvider>
      </UiStringsProvider>,
    ),
};
