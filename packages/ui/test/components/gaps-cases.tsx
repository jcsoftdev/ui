import { renderToStaticMarkup } from "react-dom/server";
import { Chip } from "../../src/atoms/chip/chip.js";
import { DueChip } from "../../src/atoms/due-chip/due-chip.js";
import { IconButton } from "../../src/atoms/icon-button/icon-button.js";
import { Kbd } from "../../src/atoms/kbd/kbd.js";
import { RadioGroup } from "../../src/atoms/radio-group/radio-group.js";
import { Seal } from "../../src/atoms/seal/seal.js";
import { Spinner } from "../../src/atoms/spinner/spinner.js";
import { Aside, AsideHeader } from "../../src/containers/aside/aside.js";
import { ErrorState } from "../../src/states/error-state/error-state.js";
import { Skeleton } from "../../src/states/skeleton/skeleton.js";
import { Banner } from "../../src/containers/banner/banner.js";
import {
  DescriptionList,
  DescriptionListItem,
} from "../../src/containers/description-list/description-list.js";
import { Feed, FeedEvent } from "../../src/containers/feed/feed.js";
import {
  ListDetail,
  ListDetailDetail,
  ListDetailEmpty,
  ListDetailHeader,
  ListDetailItem,
  ListDetailList,
} from "../../src/containers/list-detail/list-detail.js";
import { Note } from "../../src/containers/note/note.js";
import { Kpi } from "../../src/containers/kpi/kpi.js";
import { Section } from "../../src/containers/section/section.js";
import {
  Table,
  TableActionsCell,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  TableSelectAllCell,
  TableSelectCell,
} from "../../src/containers/table/table.js";
import { Timeline } from "../../src/containers/timeline/timeline.js";
import { Shortcuts, ShortcutsItem } from "../../src/containers/shortcuts/shortcuts.js";
import { DateCalendar } from "../../src/calendar/date-calendar/date-calendar.js";
import { Combobox } from "../../src/forms/combobox/combobox.js";
import { DatePicker } from "../../src/forms/date-picker/date-picker.js";
import { DateTimePicker } from "../../src/forms/date-picker/date-time-picker.js";
import { ChipGroup } from "../../src/forms/chip-group/chip-group.js";
import { Field } from "../../src/forms/field/field.js";
import { Dropzone } from "../../src/forms/dropzone/dropzone.js";
import { Input } from "../../src/forms/input/input.js";
import { NumberStepper } from "../../src/forms/number-stepper/number-stepper.js";
import { SelectMenu } from "../../src/forms/select-menu/select-menu.js";
import { UiStringsProvider } from "../../src/i18n/index.js";
import { TabsNav, TabsNavLink } from "../../src/navigation/tabs/tabs-nav.js";
import { Stepper } from "../../src/navigation/stepper/stepper.js";
import { Wizard } from "../../src/navigation/wizard/wizard.js";

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
  iconButton: (props: Record<string, unknown> = {}) =>
    renderToStaticMarkup(
      <IconButton label="Delete row" {...props}>
        <svg data-icon="" />
      </IconButton>,
    ),
  iconButtonEs: () =>
    renderToStaticMarkup(
      <UiStringsProvider locale="es">
        <IconButton label="Borrar" loading>
          <svg data-icon="" />
        </IconButton>
      </UiStringsProvider>,
    ),
  chipTag: () =>
    renderToStaticMarkup(
      <Chip size="sm" square>
        A-12
      </Chip>,
    ),
  chipDefault: () => renderToStaticMarkup(<Chip>Plain</Chip>),
  radioGroup: () =>
    renderToStaticMarkup(
      <RadioGroup
        options={[
          { value: "a", label: "Alpha", description: "First" },
          { value: "b", label: "Beta" },
        ]}
      />,
    ),
  skeleton: (props: Record<string, unknown> = {}) =>
    renderToStaticMarkup(<Skeleton {...props} />),
  skeletonEs: () =>
    renderToStaticMarkup(
      <UiStringsProvider locale="es">
        <Skeleton variant="list" />
      </UiStringsProvider>,
    ),
  errorActions: (props: Record<string, unknown> = {}) =>
    renderToStaticMarkup(
      <ErrorState
        title="Could not load"
        actions={
          <a href="/home" data-act="">
            Go home
          </a>
        }
        {...props}
      />,
    ),
  bannerSoft: () => renderToStaticMarkup(<Banner tone="warning">Careful</Banner>),
  bannerOutline: (tone: "info" | "success" | "warning" | "danger") =>
    renderToStaticMarkup(
      <Banner tone={tone} appearance="outline" title="Heads up">
        Careful
      </Banner>,
    ),
  selectMenu: (props: Record<string, unknown> = {}) =>
    renderToStaticMarkup(
      <SelectMenu
        aria-label="Tree"
        options={[
          { value: "", label: "Any" },
          { value: "cedro", label: "Cedro" },
        ]}
        {...props}
      />,
    ),
  selectMenuEs: () =>
    renderToStaticMarkup(
      <UiStringsProvider locale="es">
        <SelectMenu aria-label="Árbol" options={[{ value: "a", label: "A" }]} />
      </UiStringsProvider>,
    ),
  input: (props: Record<string, unknown> = {}) =>
    renderToStaticMarkup(<Input aria-label="Name" {...props} />),
  dropzone: (props: Record<string, unknown> = {}) =>
    renderToStaticMarkup(
      <Dropzone title="Drop files" browseLabel="Browse" hint="PDF only" onFiles={() => {}} {...props} />,
    ),
  numberStepper: (props: Record<string, unknown> = {}) =>
    renderToStaticMarkup(<NumberStepper aria-label="Qty" {...props} />),
  fieldNodeLabel: (props: Record<string, unknown> = {}) =>
    renderToStaticMarkup(
      <Field label={<span data-node-label="">Name <em>*</em></span>} hint="Shown on invoices" {...props}>
        <Input placeholder="Full name" />
        <span data-extra="">extra</span>
      </Field>,
    ),
  combobox: (props: Record<string, unknown> = {}) =>
    renderToStaticMarkup(
      <Combobox
        aria-label="Tree"
        options={[
          { value: "cedro", label: "Cedro" },
          { value: "pino", label: "Pino" },
        ]}
        {...props}
      />,
    ),
  datePicker: (props: Record<string, unknown> = {}) =>
    renderToStaticMarkup(<DatePicker aria-label="Start" {...props} />),
  datePickerEs: (props: Record<string, unknown> = {}) =>
    renderToStaticMarkup(
      <UiStringsProvider locale="es">
        <DatePicker aria-label="Inicio" {...props} />
      </UiStringsProvider>,
    ),
  datePickerPartialEs: (props: Record<string, unknown> = {}) =>
    renderToStaticMarkup(
      <UiStringsProvider locale="es">
        <UiStringsProvider strings={{ time: "hora", locale: undefined, dayPlaceholder: "" }}>
          <DatePicker aria-label="Inicio" {...props} />
        </UiStringsProvider>
      </UiStringsProvider>,
    ),
  dateCalendar: (props: Record<string, unknown> = {}) =>
    renderToStaticMarkup(<DateCalendar onSelect={() => {}} today="2026-09-07" {...props} />),
  dateCalendarEs: () =>
    renderToStaticMarkup(
      <UiStringsProvider locale="es">
        <DateCalendar onSelect={() => {}} today="2026-09-07" />
      </UiStringsProvider>,
    ),
  dateTimePicker: (props: Record<string, unknown> = {}) =>
    renderToStaticMarkup(<DateTimePicker aria-label="When" {...props} />),
  wizard: (props: Record<string, unknown> = {}) =>
    renderToStaticMarkup(
      <Wizard
        steps={[
          { id: "a", label: "Alpha", content: <p>first</p> },
          { id: "b", label: "Beta", content: <p>second</p> },
        ]}
        {...props}
      />,
    ),
  wizardEs: () =>
    renderToStaticMarkup(
      <UiStringsProvider locale="es">
        <Wizard steps={[{ id: "a", label: "Alfa", content: "x" }, { id: "b", label: "Beta", content: "y" }]} />
      </UiStringsProvider>,
    ),
  section: (props: Record<string, unknown> = {}) =>
    renderToStaticMarkup(
      <Section title="Outer" actions={<b>act</b>} {...props}>
        <Section title="Inner" divider>
          body
        </Section>
      </Section>,
    ),
  sectionWrapped: () =>
    renderToStaticMarkup(
      <Section title="Outer">
        <Section>
          <Section title="Inner">body</Section>
        </Section>
      </Section>,
    ),
  sectionComposed: (props: Record<string, unknown> = {}) =>
    renderToStaticMarkup(
      <Section {...props}>
        <Section.Header>
          <Section.Title>Guardians</Section.Title>
          <Section.Count>3</Section.Count>
          <Section.Description>Pickup</Section.Description>
          <Section.Actions>
            <b>add</b>
          </Section.Actions>
        </Section.Header>
        <Section.Body>
          <Section>
            <Section.Header>
              <Section.Title>Phones</Section.Title>
            </Section.Header>
            <Section.Body padded={false}>numbers</Section.Body>
          </Section>
        </Section.Body>
      </Section>,
    ),
  kpiComposed: (props: Record<string, unknown> = {}) =>
    renderToStaticMarkup(
      <Kpi tone="success" dot {...props}>
        <Kpi.Label trailing={<button type="button">menu</button>}>Collected</Kpi.Label>
        <Kpi.Value mono suffix="/ 12" trend={<b data-trend />}>
          840
        </Kpi.Value>
        <Kpi.Description>3 pending</Kpi.Description>
      </Kpi>,
    ),
  timelineItems: (items: Record<string, unknown>[]) =>
    renderToStaticMarkup(<Timeline aria-label="Admission" items={items as never} />),
  timelineComposed: () =>
    renderToStaticMarkup(
      <Timeline aria-label="Admission">
        <Timeline.Item title="Applied" status="done" group="March" />
        <Timeline.Item title="Interview" status="current" group="March">
          <i data-extra />
        </Timeline.Item>
        <Timeline.Item title="Decision" status="pending" group="April" />
      </Timeline>,
    ),
  table: (props: Record<string, unknown> = {}, menu?: boolean) =>
    renderToStaticMarkup(
      <Table {...props}>
        <TableHead>
          <TableRow>
            {props.selectedKeys !== undefined || props.defaultSelectedKeys !== undefined ? (
              <TableSelectAllCell rowKeys={["a", "b"]} />
            ) : null}
            <TableHeaderCell>Name</TableHeaderCell>
            <TableHeaderCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {["a", "b"].map((key) => (
            <TableRow key={key} rowKey={key}>
              {props.selectedKeys !== undefined || props.defaultSelectedKeys !== undefined ? (
                <TableSelectCell rowKey={key} label={`Row ${key}`} />
              ) : null}
              <TableCell>{key}</TableCell>
              <TableActionsCell menu={menu ? <button type="button">more</button> : undefined}>
                <a href="#x">Edit</a>
              </TableActionsCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>,
    ),
  tableEs: () =>
    renderToStaticMarkup(
      <UiStringsProvider locale="es">
        <Table defaultSelectedKeys={["a"]}>
          <TableBody>
            <TableRow rowKey="a">
              <TableSelectCell rowKey="a" label="Ana" />
            </TableRow>
          </TableBody>
        </Table>
      </UiStringsProvider>,
    ),
  note: (props: Record<string, unknown> = {}) =>
    renderToStaticMarkup(<Note {...props}>Careful</Note>),
  aside: () =>
    renderToStaticMarkup(
      <Aside>
        <AsideHeader title="Pending" action={<a href="#a">All</a>} />
      </Aside>,
    ),
  asideEs: () =>
    renderToStaticMarkup(
      <UiStringsProvider locale="es">
        <Aside />
      </UiStringsProvider>,
    ),
  descriptionList: (props: Record<string, unknown> = {}) =>
    renderToStaticMarkup(
      <DescriptionList {...props}>
        <DescriptionListItem term="Name">Ana</DescriptionListItem>
        <DescriptionListItem term="Phone" emptyLabel="None" />
        <DescriptionListItem term="Zero">{0}</DescriptionListItem>
      </DescriptionList>,
    ),
  feed: () =>
    renderToStaticMarkup(
      <Feed>
        <FeedEvent icon={<i>i</i>} time="2026-03-04T15:30:00Z" timeZone="UTC" meta="Ana">
          Created
        </FeedEvent>
        <FeedEvent time="2026-03-03">Updated</FeedEvent>
        <FeedEvent>No time</FeedEvent>
      </Feed>,
    ),
  feedEs: () =>
    renderToStaticMarkup(
      <UiStringsProvider locale="es">
        <Feed>
          <FeedEvent time="2026-03-03">Actualizado</FeedEvent>
        </Feed>
      </UiStringsProvider>,
    ),
  shortcuts: () =>
    renderToStaticMarkup(
      <Shortcuts aria-label="Quick">
        <ShortcutsItem href="#a" icon={<i>i</i>} kbd="G A" count={2}>
          Alpha
        </ShortcutsItem>
        <ShortcutsItem>Action</ShortcutsItem>
        <ShortcutsItem asChild kbd="G R">
          <a href="/r" data-router="">
            Routed
          </a>
        </ShortcutsItem>
      </Shortcuts>,
    ),
  listDetail: (props: Record<string, unknown> = {}) =>
    renderToStaticMarkup(
      <ListDetail aria-label="Students" {...props}>
        <ListDetailList>
          <ListDetailItem value="a">Ana</ListDetailItem>
          <ListDetailItem value="b">Bea</ListDetailItem>
        </ListDetailList>
        <ListDetailDetail>detail</ListDetailDetail>
      </ListDetail>,
    ),
  listDetailRail: (props: Record<string, unknown> = {}) =>
    renderToStaticMarkup(
      <ListDetail aria-label="Students" {...props}>
        <ListDetailList header={<ListDetailHeader count={2}>filters</ListDetailHeader>}>
          <ListDetailItem value="a">Ana</ListDetailItem>
        </ListDetailList>
        <ListDetailDetail>
          <ListDetailEmpty title="Pick one" description="From the list" />
        </ListDetailDetail>
      </ListDetail>,
    ),
  dueChip: (props: Record<string, unknown> = {}) =>
    renderToStaticMarkup(<DueChip date="2026-03-20" today="2026-03-04" {...props} />),
  dueChipEs: (props: Record<string, unknown> = {}) =>
    renderToStaticMarkup(
      <UiStringsProvider locale="es">
        <DueChip date="2026-03-01" today="2026-03-04" {...props} />
      </UiStringsProvider>,
    ),
  seal: (props: Record<string, unknown> = {}) =>
    renderToStaticMarkup(
      <Seal title="Receipt" {...props}>
        <p>Issuer</p>
      </Seal>,
    ),
  chipGroup: (props: Record<string, unknown> = {}) =>
    renderToStaticMarkup(
      <ChipGroup
        aria-label="Subjects"
        options={[
          { value: "m", label: "Math", count: 2 },
          { value: "a", label: "Art" },
          { value: "p", label: "PE", disabled: true },
        ]}
        {...props}
      />,
    ),
  chipGroupInField: () =>
    renderToStaticMarkup(
      <Field label="Subjects" hint="Pick" error="Required">
        <ChipGroup options={[{ value: "m", label: "Math" }]} />
      </Field>,
    ),
  tabsNav: (props: Record<string, unknown> = {}) =>
    renderToStaticMarkup(
      <TabsNav aria-label="Sections" value="b" {...props}>
        <TabsNavLink value="a" href="/a">
          Alpha
        </TabsNavLink>
        <TabsNavLink value="b" href="/b" count={3}>
          Beta
        </TabsNavLink>
        <TabsNavLink value="c" asChild>
          <a href="/c" data-router="">
            Gamma
          </a>
        </TabsNavLink>
      </TabsNav>,
    ),
  stepper: (steps: Record<string, unknown>[], currentStepId = "b", locale: "en" | "es" = "en") =>
    renderToStaticMarkup(
      <UiStringsProvider locale={locale}>
        <Stepper aria-label="Steps" steps={steps as never} currentStepId={currentStepId} />
      </UiStringsProvider>,
    ),
  kbd: () => renderToStaticMarkup(<Kbd className="extra">⌘K</Kbd>),
};
