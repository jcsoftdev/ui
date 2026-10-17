import { renderToStaticMarkup } from "react-dom/server";
import { DueChip } from "../../src/atoms/due-chip/due-chip.js";
import { Kbd } from "../../src/atoms/kbd/kbd.js";
import { Seal } from "../../src/atoms/seal/seal.js";
import { Spinner } from "../../src/atoms/spinner/spinner.js";
import { Aside, AsideHeader } from "../../src/containers/aside/aside.js";
import { Banner } from "../../src/containers/banner/banner.js";
import {
  DescriptionList,
  DescriptionListItem,
} from "../../src/containers/description-list/description-list.js";
import { Feed, FeedEvent } from "../../src/containers/feed/feed.js";
import { ListDetail, ListDetailDetail, ListDetailItem, ListDetailList } from "../../src/containers/list-detail/list-detail.js";
import { Note } from "../../src/containers/note/note.js";
import { Section } from "../../src/containers/section/section.js";
import { Shortcuts, ShortcutsItem } from "../../src/containers/shortcuts/shortcuts.js";
import { Combobox } from "../../src/forms/combobox/combobox.js";
import { DatePicker } from "../../src/forms/date-picker/date-picker.js";
import { DateTimePicker } from "../../src/forms/date-picker/date-time-picker.js";
import { SelectMenu } from "../../src/forms/select-menu/select-menu.js";
import { UiStringsProvider } from "../../src/i18n/index.js";
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
  kbd: () => renderToStaticMarkup(<Kbd className="extra">⌘K</Kbd>),
};
