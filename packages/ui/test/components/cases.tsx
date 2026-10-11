import { renderToStaticMarkup } from "react-dom/server";
import { Skeleton } from "../../src/states/skeleton/skeleton.js";
import { Button } from "../../src/atoms/button/button.js";
import { Checkbox } from "../../src/atoms/checkbox/checkbox.js";
import { Chip } from "../../src/atoms/chip/chip.js";
import { ConfirmAction } from "../../src/containers/confirm-action/confirm-action.js";
import { Banner } from "../../src/containers/banner/banner.js";
import { Field } from "../../src/forms/field/field.js";
import { Input } from "../../src/forms/input/input.js";
import { ErrorState } from "../../src/states/error-state/error-state.js";
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
  fieldPlain: () =>
    renderToStaticMarkup(
      <Field label="Name">
        <Input />
      </Field>,
    ),
  fieldOptional: () =>
    renderToStaticMarkup(
      <Field label="Phone" optional hint="9 digits" error={null} id="phone">
        <Input />
      </Field>,
    ),
  fieldOptionalEs: () =>
    renderToStaticMarkup(
      <UiStringsProvider locale="es">
        <Field label="Teléfono" optional>
          <Input />
        </Field>
      </UiStringsProvider>,
    ),
  fieldError: () =>
    renderToStaticMarkup(
      <Field label="Phone" error="Too short" id="phone">
        <Input />
      </Field>,
    ),
  bannerTone: (tone: "info" | "success" | "warning" | "danger") =>
    renderToStaticMarkup(<Banner tone={tone}>Saved</Banner>),
  bannerTitle: () =>
    renderToStaticMarkup(
      <Banner tone="danger" title="Payment failed">
        Try another card
      </Banner>,
    ),
  bannerNoIcon: () =>
    renderToStaticMarkup(
      <Banner tone="success" icon={null}>
        Saved
      </Banner>,
    ),
  bannerCustomIcon: () =>
    renderToStaticMarkup(
      <Banner icon={<i data-custom />}>Saved</Banner>,
    ),
  chipStatus: (tone: "info" | "success" | "warning" | "danger" | "neutral") =>
    renderToStaticMarkup(
      <Chip tone={tone} statusIcon>
        Paid
      </Chip>,
    ),
  chipIcon: () =>
    renderToStaticMarkup(
      <Chip tone="success" statusIcon icon={<i data-custom />}>
        Paid
      </Chip>,
    ),
  buttonLoading: () =>
    renderToStaticMarkup(
      <Button loading loadingLabel="Saving…">
        Save
      </Button>,
    ),
  buttonIdle: () => renderToStaticMarkup(<Button loadingLabel="Saving…">Save</Button>),
  buttonPlain: () => renderToStaticMarkup(<Button>Save</Button>),
  buttonLayout: () =>
    renderToStaticMarkup(
      <Button block size="lg">
        Pay
      </Button>,
    ),
  errorLegacy: () => renderToStaticMarkup(<ErrorState message="Could not load" onRetry={() => {}} />),
  errorTitle: () =>
    renderToStaticMarkup(
      <ErrorState title="Could not load" description="Your data is safe." correlationId="a1b2" />,
    ),
  errorRawObject: () =>
    renderToStaticMarkup(
      <ErrorState message={new Error("ECONNRESET at 10.0.0.4") as never} onRetry={() => {}} />,
    ),
  errorEs: () =>
    renderToStaticMarkup(
      <UiStringsProvider locale="es">
        <ErrorState title="No se pudo cargar" onRetry={() => {}} correlationId="x" />
      </UiStringsProvider>,
    ),
  confirmIdle: () =>
    renderToStaticMarkup(
      <ConfirmAction label="Cancel order" consequence="The order is cancelled." onConfirm={async () => {}} />,
    ),
  confirmEs: () =>
    renderToStaticMarkup(
      <UiStringsProvider locale="es">
        <ConfirmAction label="Anular" consequence="Se anula." onConfirm={async () => {}} />
      </UiStringsProvider>,
    ),
};
export { runConfirm } from "../../src/containers/confirm-action/model.js";
