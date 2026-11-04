import { renderToStaticMarkup } from "react-dom/server";
import { Avatar } from "../../src/atoms/avatar/avatar.js";
import { NumberStepper } from "../../src/forms/number-stepper/number-stepper.js";
import { UiStringsProvider } from "../../src/i18n/index.js";
import { DialogHeader } from "../../src/overlays/dialog/dialog.js";
import { Skeleton, SkeletonGroup } from "../../src/states/skeleton/skeleton.js";

export const html = {
  dialogHeader: (className?: string) =>
    renderToStaticMarkup(<DialogHeader className={className}>x</DialogHeader>),
  skeletons: () =>
    renderToStaticMarkup(
      <>
        <Skeleton />
        <Skeleton variant="list" />
      </>,
    ),
  skeletonQuiet: () => renderToStaticMarkup(<Skeleton announce={false} />),
  skeletonGroup: () =>
    renderToStaticMarkup(
      <SkeletonGroup label="Cargando pedidos">
        <Skeleton variant="kpis" />
        <Skeleton variant="list" />
        <Skeleton announce />
      </SkeletonGroup>,
    ),
  avatar: (props: { decorative?: boolean; "aria-hidden"?: boolean } = {}) =>
    renderToStaticMarkup(<Avatar name="Luis Ramirez" {...props} />),
  stepper: (props: Record<string, unknown> = {}, locale?: "en" | "es") =>
    renderToStaticMarkup(
      <UiStringsProvider {...(locale ? { locale } : {})}>
        <NumberStepper aria-label="billetes de S/ 100" defaultValue={2} {...props} />
      </UiStringsProvider>,
    ),
};
