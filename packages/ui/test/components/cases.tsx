import { renderToStaticMarkup } from "react-dom/server";
import { Skeleton } from "../../src/states/skeleton/skeleton.js";
import { Checkbox } from "../../src/atoms/checkbox/checkbox.js";
import { Chip } from "../../src/atoms/chip/chip.js";
import { RadioGroup } from "../../src/atoms/radio-group/radio-group.js";
import { Switch } from "../../src/atoms/switch/switch.js";
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
  checkbox: () => renderToStaticMarkup(<Checkbox />),
  switch: () => renderToStaticMarkup(<Switch />),
  radio: () => renderToStaticMarkup(<RadioGroup options={[{ value: "a", label: "A" }]} />),
  chipStatic: () => renderToStaticMarkup(<Chip>Paid</Chip>),
  chipInteractive: () => renderToStaticMarkup(<Chip onClick={() => {}}>Paid</Chip>),
};
