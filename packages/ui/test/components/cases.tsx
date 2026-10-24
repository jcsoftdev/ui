import { renderToStaticMarkup } from "react-dom/server";
import { Skeleton } from "../../src/states/skeleton/skeleton.js";
import { Button } from "../../src/atoms/button/button.js";
import { Checkbox } from "../../src/atoms/checkbox/checkbox.js";
import { Avatar } from "../../src/atoms/avatar/avatar.js";
import { Chip } from "../../src/atoms/chip/chip.js";
import { StatusDot } from "../../src/atoms/status-dot/status-dot.js";
import { Kpi } from "../../src/containers/kpi/kpi.js";
import { KpiGroup } from "../../src/containers/kpi-group/kpi-group.js";
import { CopyField } from "../../src/forms/copy-field/copy-field.js";
import { Topbar } from "../../src/shell/topbar/topbar.js";
import { EmptyState } from "../../src/states/empty-state/empty-state.js";
import { CardHeader } from "../../src/containers/card/card.js";
import { PageHeader } from "../../src/containers/page-header/page-header.js";
import { PageHeaderBack } from "../../src/containers/page-header/back.js";
import { Segmented } from "../../src/navigation/segmented/segmented.js";
import { ConfirmAction } from "../../src/containers/confirm-action/confirm-action.js";
import { ResponsiveList } from "../../src/containers/responsive-list/responsive-list.js";
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
  checkboxIndeterminate: () => renderToStaticMarkup(<Checkbox defaultChecked="indeterminate" />),
  checkboxChecked: () => renderToStaticMarkup(<Checkbox defaultChecked />),
  switch: () => renderToStaticMarkup(<Switch />),
  radio: () => renderToStaticMarkup(<RadioGroup options={[{ value: "a", label: "A" }]} />),
  chipStatic: () => renderToStaticMarkup(<Chip>Paid</Chip>),
  chipRemovable: () => renderToStaticMarkup(<Chip onRemove={() => {}}>Paid</Chip>),
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
  chipTone: (tone: string) => renderToStaticMarkup(<Chip tone={tone}>Yape</Chip>),
  statusDotTone: (tone: string) =>
    renderToStaticMarkup(<StatusDot tone={tone} label="Yape" showLabel />),
  kpiTone: (tone?: string) =>
    renderToStaticMarkup(<Kpi label="Cobrado" value="10" tone={tone} dot icon={<i data-icon />} trend={<b data-trend />} />),
  kpiPlain: () => renderToStaticMarkup(<Kpi label="Cobrado" value="10" />),
  kpiDanger: () => renderToStaticMarkup(<Kpi label="Bajo" value="1" variant="danger" />),
  avatarTone: (tone?: string) => renderToStaticMarkup(<Avatar name="Ana Ruiz" tone={tone} />),
  avatarStatus: () =>
    renderToStaticMarkup(<Avatar name="Ana Ruiz" status="success" statusLabel="Online" />),
  kpiGroupAutoFit: () =>
    renderToStaticMarkup(
      <KpiGroup layout="auto-fit" minItemWidth={160} animate={false} items={[{ id: "a", label: "A", value: "1" }]} />,
    ),
  copyField: (locale?: "es") => {
    const field = <CopyField label="Webhook" value="https://x.test/hook" />;
    return renderToStaticMarkup(locale ? <UiStringsProvider locale={locale}>{field}</UiStringsProvider> : field);
  },
  topbarBare: () => renderToStaticMarkup(<Topbar end={<i data-end />} />),
  topbarFull: () =>
    renderToStaticMarkup(
      <Topbar breadcrumbs={["A", "B"]} breadcrumbsLabel="Ruta" onSearch={() => {}} searchPlaceholder="Buscar" />,
    ),
  emptyOutlined: () => renderToStaticMarkup(<EmptyState title="Vacío" variant="outlined" />),
  errorOutlined: () => renderToStaticMarkup(<ErrorState message="Falló" variant="outlined" />),
  pageHeaderCompact: () => renderToStaticMarkup(<PageHeader compact />),
  pageHeaderSlots: (props: Record<string, unknown> = {}) =>
    renderToStaticMarkup(
      <PageHeader
        back={<PageHeaderBack href="/applicants" />}
        breadcrumbs={<nav>crumbs</nav>}
        meta={<span>facts</span>}
        tabs={<nav>tabs</nav>}
        {...props}
      >
        <h1>Title</h1>
      </PageHeader>,
    ),
  cardHeaderSlots: () =>
    renderToStaticMarkup(<CardHeader icon={<i data-icon />} title="Caja" action={<b data-action />} />),
  segmentedOptions: (block?: boolean) =>
    renderToStaticMarkup(
      <Segmented
        aria-label="Vista"
        block={block}
        defaultValue="dia"
        options={[
          { value: "dia", label: "Día" },
          { value: "mes", label: "Mes" },
        ]}
      />,
    ),
  buttonLoadingDefault: () => renderToStaticMarkup(<Button loading>Save</Button>),
  buttonLoadingDefaultEs: () =>
    renderToStaticMarkup(
      <UiStringsProvider locale="es">
        <Button loading>Guardar</Button>
      </UiStringsProvider>,
    ),
  buttonLoading: () =>
    renderToStaticMarkup(
      <Button loading loadingLabel="Saving…">
        Save
      </Button>,
    ),
  buttonLoadingDisabled: () =>
    renderToStaticMarkup(
      <Button loading disabled>
        Save
      </Button>,
    ),
  buttonIdle: () => renderToStaticMarkup(<Button loadingLabel="Saving…">Save</Button>),
  buttonPrimary: () => renderToStaticMarkup(<Button variant="primary">Save</Button>),
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
  list: (withActions: boolean, locale?: "es") => {
    const items = [
      { id: "a1", name: "Marco", total: "S/ 45", city: "Lima" },
      { id: "b2", name: "Lucía", total: "S/ 80", city: "Cusco" },
    ];
    const list = (
      <ResponsiveList
        caption="Orders"
        items={items}
        rowKey={(item) => item.id}
        rowClassName={(item) => (item.id === "b2" ? "is-late" : undefined)}
        columns={[
          { key: "city", header: "City", cell: (item) => item.city },
          { key: "name", header: "Customer", cell: (item) => item.name, primary: true },
          { key: "total", header: "Total", cell: (item) => item.total, align: "end" },
        ]}
        renderActions={withActions ? (item) => <button type="button">Open {item.id}</button> : undefined}
      />
    );
    return renderToStaticMarkup(locale ? <UiStringsProvider locale={locale}>{list}</UiStringsProvider> : list);
  },
};
export { runConfirm } from "../../src/containers/confirm-action/model.js";
