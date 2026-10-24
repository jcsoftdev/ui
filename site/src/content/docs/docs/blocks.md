---
title: Building blocks for app screens
description: Spinner, Kbd, Tooltip, AlertDialog, SelectMenu, Combobox, date pickers, Wizard, Section, ListDetail, Feed, TabsNav and the other blocks added for application screens, with props, accessibility notes and examples.
section: Guides
---

These components and props were added together so an application can drop an in-house kit and import everything from `@jcsoftdev/ui`. All of them are additive, zero-dependency, take their default texts from `UiStringsProvider` (en/es), lay out with container queries (never viewport queries) and follow the touch density preset. Each one also has a generated page under Components with the full props table.

Every example below is type-checked against the built package (`pnpm check:docs-examples`).

## Atoms

| Component    | Props worth knowing                                                                                                                                                                                                                                                                    |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Spinner`    | `size` (`xs`, `sm`, `md`, `lg` or a pixel number), `label` (defaults to the localized "Loading"; `label={false}` makes it decorative). Reduced motion leaves a static ring.                                                                                                            |
| `Kbd`        | A styled `<kbd>`; compose several for a chord.                                                                                                                                                                                                                                         |
| `IconButton` | Required `label` (becomes `aria-label`), `variant`, `size` (`sm`, `md`, `lg`), `loading` (busy like `Button`: keeps focus, ignores clicks), `asChild`. A `Button` with a square box that grows with touch density.                                                                     |
| `Chip`       | New `size="sm"` (compact metrics). A tag is `<Chip size="sm" square>`.                                                                                                                                                                                                                 |
| `DueChip`    | `date`, `today` (reference day, pass it for deterministic SSR), `soonDays` (3), `done`, `state` (forces `overdue`, `soon`, `ok` or `done` whatever the date says), `locale`. Overdue and soon states add a status glyph and a screen-reader suffix, so color is never the only signal. |
| `Seal`       | `title`, `icon`, `tone` (`accent`, `success`, `warning`, `danger`, `neutral`, `institutional`, or any `tonePalettes` tone by name), `label` (names the seal as a group). Children are the lines.                                                                                       |

```tsx region=atoms
export function Atoms() {
  return (
    <>
      <Spinner size="sm" label="Saving" />
      <p>
        Press <Kbd>Ctrl</Kbd> + <Kbd>K</Kbd>
      </p>
      <IconButton label="Close" variant="ghost" size="sm">
        <span aria-hidden>x</span>
      </IconButton>
      <Chip size="sm" square>
        Draft
      </Chip>
      <DueChip date="2026-10-20" today="2026-10-17" />
      <Seal title="Certified" tone="success" label="Certificate seal">
        <p>No. 0042</p>
      </Seal>
    </>
  );
}
```

Date strings (`YYYY-MM-DD`, naive `YYYY-MM-DDTHH:mm`) are read as the written day and never shift with the viewer's time zone. An instant with `Z` or an offset lands on the viewer's local day.

## Overlays

| Component           | Props worth knowing                                                                                                                                                                                                                                                                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Tooltip`           | `content`, `shortcut` (rendered as `Kbd`), `side`, `align`, `openDelay` (300 ms), `closeDelay` (100 ms), `open`/`defaultOpen`/`onOpenChange`, `disabled`.                                                                                                                                                                                                |
| `AlertDialog`       | `trigger`, `title`, `description`, `tone` (`default`, `danger`), `confirmLabel`, `cancelLabel`, `onConfirm`, `onCancel`, `initialFocus` (cancel by default), `confirmDisabled`, `cancelDisabled`, `open`/`onOpenChange`.                                                                                                                                 |
| `AlertDialog` parts | `AlertDialog.Root`, `.Trigger`, `.Content`, `.Header`, `.Title`, `.Description`, `.Body`, `.Footer`, `.Cancel`, `.Action`. Same alertdialog: no close button, outside presses ignored, focus on Cancel, Escape closes. Cancel and Action close after their `onClick` unless it calls `preventDefault()`. Per-action `disabled` is the button's own prop. |
| `toast`             | New tones `toast.info`, `toast.warning`, `toast.danger` (same as `toast.error`).                                                                                                                                                                                                                                                                         |

```tsx region=overlays
export function Overlays({ onDelete }: { onDelete: () => Promise<void> }) {
  return (
    <>
      <Tooltip content="Search" shortcut="Ctrl K">
        <Button>Search</Button>
      </Tooltip>
      <AlertDialog
        trigger={<Button variant="danger">Delete</Button>}
        title="Delete this order?"
        description="This cannot be undone."
        tone="danger"
        onConfirm={async () => {
          await onDelete();
        }}
      />
      <Button onClick={() => toast.warning("Check the amounts")}>Warn</Button>
    </>
  );
}
```

Accessibility: `Tooltip` has `role="tooltip"`, never takes focus, links to the trigger with `aria-describedby` only while open, opens on keyboard focus at once and closes with Escape; touch never opens it by hover. `AlertDialog` has `role="alertdialog"`, no close button, ignores outside presses and lands focus on Cancel. `onConfirm` may return nothing, `{ ok: true }`, `{ ok: false, error }` or throw: while pending the confirm button is busy, Cancel and Escape are blocked and a second press is ignored; a failure keeps the dialog open with a `role="alert"` message.

Toasts: success, info, warning and error toasts are tinted with their tone and carry a status glyph. Only error is an alert; the others are status messages. In tests, reset the global toast store between cases with the testing entry, which is kept off the main `overlays` entry so production bundles never carry it.

```tsx region=testing
import { resetToasts } from "@jcsoftdev/ui/overlays/testing";

export function afterEachTest() {
  resetToasts();
}
```

## Forms and dates

| Component        | Props worth knowing                                                                                                                                                                                                                             |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SelectMenu`     | Custom listbox select: `options` (option or `{ label, options }` group), `value`/`defaultValue`/`onValueChange`, `placeholder`, `name` (hidden input), `required`, `invalid`, `size`. Use the native `Select` when the system picker is wanted. |
| `Combobox`       | `options`, `value`/`onValueChange(value, option)`, `onSearchChange` (debounce is yours), `filter` (`true`, `false` for server-side, or a function), `maxVisible` (50), `loading`, `emptyText`, `clearable`, `valueLabel`, `name`.               |
| `DateCalendar`   | Standalone date grid: `value`, `onSelect`, `min`, `max`, `isDateDisabled`, `locale`, `weekStartsOn`.                                                                                                                                            |
| `DatePicker`     | Typed masked input plus calendar popover. ISO `YYYY-MM-DD` values, `min`, `max`, `isDateDisabled`, `clearable`, `name`, `invalid`.                                                                                                              |
| `DateTimePicker` | Date plus time, value `YYYY-MM-DDTHH:mm` (no zone, `""` while incomplete), `step` in minutes.                                                                                                                                                   |
| `ChipGroup`      | Toggle chips: `options` (`value`, `label`, `count`, `icon`, `disabled`), `type` (`multiple` default, or `single` with `allowDeselect`), `name`.                                                                                                 |

```tsx region=forms
export function Forms() {
  const [city, setCity] = useState("lima");
  return (
    <>
      <Field label="City">
        <SelectMenu
          value={city}
          onValueChange={setCity}
          options={[
            { value: "lima", label: "Lima" },
            { value: "cusco", label: "Cusco", disabled: true },
          ]}
        />
      </Field>
      <Field label="Student">
        <Combobox
          options={[{ value: "1", label: "Ana Quispe" }]}
          onSearchChange={(query) => void query}
        />
      </Field>
      <Field label="Due date">
        <DatePicker min="2026-01-01" />
      </Field>
      <Field label="Starts">
        <DateTimePicker step={15} />
      </Field>
      <ChipGroup
        options={[
          { value: "open", label: "Open", count: 4 },
          { value: "closed", label: "Closed" },
        ]}
        defaultValue={["open"]}
      />
      <DateCalendar value="2026-10-17" onSelect={(date) => void date} />
    </>
  );
}
```

Accessibility: `SelectMenu` and `Combobox` follow the WAI-ARIA combobox and listbox patterns (focus stays on the trigger or input, `aria-activedescendant`, arrows, Home/End, typeahead, Escape). Disabled options are skipped and options are 44px tall under touch density. Inside `Field` the listbox is named from the label. The calendar grid uses a roving tabindex with arrows, Home/End, PageUp/PageDown and Shift+Page for years; out-of-range dates stay focusable with `aria-disabled`. Weeks start on Monday for es-PE and en-GB, and on Sunday for US-style locales; override with `weekStartsOn`. `ChipGroup` is a named group of `aria-pressed` toggle buttons with roving focus; a check glyph marks selected chips.

### Form layout

A typical create or edit form is `Form > FormSection > FormGrid > Field`, closed by a `FormFooter`.

| Component     | Props worth knowing                                                                                                                                                                                                                    |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FormSection` | `title`, `description`. The title column sits beside the fields from 640px of container width and stacks above them in a narrower one (a drawer, a split pane).                                                                        |
| `FormGrid`    | `columns` 1 to 3 (default 2): the most columns it reaches, 2 from 620px and 3 from 900px of container width. `FormGridItem span` (1, 2, 3 or `"full"`) never adds a column the grid does not have.                                     |
| `Fieldset`    | `legend`, `description`; a native `fieldset`, so `disabled` reaches every control inside.                                                                                                                                              |
| `Field`       | `required` adds a visible `*` and `aria-required` on the control (native validation stays off); `disabled` disables the control and mutes the label.                                                                                   |
| `FormFooter`  | Sticky by default (`sticky={false}` to opt out). `onCancel` shows Cancel, `submitLabel`, `submitDisabled`, `dirty` shows "Unsaved changes" in a polite status region, `busy` keeps the submit focusable but inert and disables Cancel. |

```tsx region=form-layout
export function CreateStudent({ saving, onCancel }: { saving: boolean; onCancel: () => void }) {
  return (
    <Form>
      <FormSection title="Student" description="Shown on reports and certificates.">
        <FormGrid columns={2}>
          <Field label="First name" required>
            <Input />
          </Field>
          <Field label="Last name" required>
            <Input />
          </Field>
          <FormGridItem span="full">
            <Field label="Notes" optional>
              <Textarea />
            </Field>
          </FormGridItem>
        </FormGrid>
      </FormSection>
      <FormSection title="Guardian">
        <Fieldset legend="Primary contact" description="Receives every notice.">
          <Field label="Email" required>
            <Input type="email" />
          </Field>
        </Fieldset>
      </FormSection>
      <FormFooter dirty busy={saving} onCancel={onCancel} submitLabel="Create student" />
    </Form>
  );
}
```

## Navigation

| Component                 | Props worth knowing                                                                                                                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Wizard`                  | `steps` (`id`, `label`, `content`, `canAdvance`), `value`/`defaultValue`/`onValueChange(stepId)`, `onBeforeNext`, `onComplete`, `backLabel`/`nextLabel`/`finishLabel`. Gates may be async; a throw keeps the step and shows an alert.      |
| `Stepper`                 | `steps` (`id`, `label`, `status`), `currentStepId`. `status` is `done` (check), `current`, `error` (cross) or `pending`; done and error also speak their state. Without `status` the step is `current` or `pending` from `currentStepId`.  |
| `TabsNav` / `TabsNavLink` | A link strip for sub-navigation: required `aria-label` on the strip, `value` marks the current item (`aria-current="page"`), `count`, `renderLink` or `asChild` for client routers. No tab roles or panels; use `Tabs` for in-page panels. |

```tsx region=wizard
export function Enrollment() {
  return (
    <Wizard
      steps={[
        { id: "who", label: "Student", content: <p>Pick a student</p> },
        {
          id: "plan",
          label: "Plan",
          content: <p>Choose a plan</p>,
          canAdvance: async () => true,
        },
      ]}
      onComplete={async () => {}}
    />
  );
}

export function SectionNav() {
  return (
    <TabsNav aria-label="Account" value="profile">
      <TabsNavLink value="profile" href="/profile">
        Profile
      </TabsNavLink>
      <TabsNavLink value="billing" href="/billing" count={2}>
        Billing
      </TabsNavLink>
    </TabsNav>
  );
}
```

The wizard heading takes focus on every step change, Enter in a single-line input advances, and the footer stacks under 420px of the wizard's own width.

## Containers

| Component                     | Props worth knowing                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Banner`                      | `appearance="outline"`: page surface where only the border carries the tone (default `soft`).                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `Section`                     | `title`, `count`, `description`, `actions`, `divider` (default off), `padded`, `as`, `titleAs`. The heading level steps down per titled nesting; a section with no title takes no level. Parts `Section.Header`, `.Title`, `.Count`, `.Description`, `.Actions`, `.Body` replace the props when a part is a direct child.                                                                                                                                                                                                                  |
| `Kpi`                         | `label`, `value`, `suffix`, `description`, `tone`, `dot`, `icon`, `trend`, plus `trailing` (interactive content at the end of the label row) and `card` (border and radius). Parts `Kpi.Label`, `.Value` (`mono`, `suffix`, `trend`), `.Description`.                                                                                                                                                                                                                                                                                      |
| `Timeline`                    | `items` or `Timeline.Item` children (both: items first). `status` per item: `done`, `current`, `error`, `pending`; `tone` still wins for the marker colour.                                                                                                                                                                                                                                                                                                                                                                                |
| `Table`                       | `flush` (`true`, `"start"`, `"end"`), `stickyHeader` (needs `maxHeight`), `maxHeight`, selection (`selectedKeys`, `defaultSelectedKeys`, `onSelectedKeysChange`, `rowKey`, `TableSelectCell`, `TableSelectAllCell`), `TableActionsCell` (`menu`).                                                                                                                                                                                                                                                                                          |
| `Note`                        | `tone` (`neutral`, `info`, `success`, `warning`, `danger`), `divider`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `Aside` / `AsideHeader`       | Complementary region named by the localized "Related information" (or `aria-label`).                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `DescriptionList`             | New `layout` (`auto`, `inline`, `stacked`), `columns` (1 to 3 pairs per row from 28rem), `valueAlign` (`end` default, `start`). `DescriptionListItem` has `term`, children as the value and a dash placeholder for `null`, `undefined`, `false` and `""` (0 is a value).                                                                                                                                                                                                                                                                   |
| `ListDetail`                  | Master-detail: `value`/`onValueChange` (never `null`), `onBack`, required `aria-label`, parts `ListDetailList` (`header`), `ListDetailHeader` (`count`), `ListDetailItem`, `ListDetailTitle`, `ListDetailMeta`, `ListDetailDetail`, `ListDetailDetailHeader`, `ListDetailEmpty`, plus `useListDetail()`. Layout: `listWidth` (rail, number = px), `ratio` (`1:1` default, `1:2`, `1:3`), `surface` (`flat` default, `card`), `stickyList`, `stickyOffset`. One pane under 641px of its own width, with focus moved to the detail and back. |
| `Feed` / `FeedEvent`          | Activity log: `icon`, `time` (ISO instant, calendar date or `Date`), `relative`, `now`, `timeZone`, `timeLabel`, `meta`.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `Shortcuts` / `ShortcutsItem` | Link or button tiles: `href`, `asChild`, `icon`, `count`, `kbd`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

```tsx region=containers
export function Containers() {
  return (
    <>
      <Banner tone="warning" appearance="outline" title="Heads up">
        Grades close on Friday.
      </Banner>
      <Section title="Guardians" count={2} actions={<Button size="sm">Add</Button>} divider>
        <DescriptionList layout="stacked" columns={2} valueAlign="start">
          <DescriptionListItem term="Name">Rosa Quispe</DescriptionListItem>
          <DescriptionListItem term="Phone">{null}</DescriptionListItem>
        </DescriptionList>
        <Note tone="info">Contacts are verified yearly.</Note>
      </Section>
      <Aside>
        <AsideHeader title="Related" />
      </Aside>
      <Feed>
        <FeedEvent time="2026-10-17T09:30:00Z" relative>
          Invoice sent
        </FeedEvent>
      </Feed>
      <Shortcuts>
        <ShortcutsItem href="/grades" kbd="G">
          Grades
        </ShortcutsItem>
      </Shortcuts>
    </>
  );
}

export function Inbox() {
  return (
    <ListDetail aria-label="Messages" defaultValue={null}>
      <ListDetailList>
        <ListDetailItem value="m1">
          <ListDetailTitle>Welcome</ListDetailTitle>
        </ListDetailItem>
      </ListDetailList>
      <ListDetailDetail>
        <ListDetailDetailHeader title="Welcome" />
        <p>Body</p>
      </ListDetailDetail>
    </ListDetail>
  );
}
```

None of `Section`, `Note`, `Aside`, `DescriptionList` or `Feed` pads its inline edges; the caller owns the gutter.

### List and detail as a rail

By default `ListDetail` splits the width evenly and draws only a divider. For a catalogue, give the list a rail with `listWidth` (320px is a good start) or a proportion with `ratio`, and set `surface="card"` for raised panes. `stickyList` keeps the list column in view and scrolls it on its own below an optional `stickyOffset` (the height of a sticky top bar). Put search, filter chips and the result count in a `ListDetailHeader` passed as the list's `header`: it stays at the top while the items scroll, and its `count` is announced politely. `ListDetailEmpty` fills the detail pane until an item is chosen and renders nothing afterwards. The list column is now a wrapper around the named `ul`, so styling that targeted the `ul` through `ListDetailList` keeps working, while a selector for the list's parent no longer reaches the grid.

```tsx region=list-detail-rail
export function StudentRail({ rows }: { rows: { id: string; name: string }[] }) {
  return (
    <ListDetail aria-label="Students" listWidth={320} surface="card" stickyList>
      <ListDetailList
        header={
          <ListDetailHeader count={rows.length}>
            <ChipGroup
              type="single"
              aria-label="Status"
              defaultValue="all"
              options={[
                { value: "all", label: "All" },
                { value: "active", label: "Active" },
              ]}
            />
          </ListDetailHeader>
        }
      >
        {rows.map((row) => (
          <ListDetailItem key={row.id} value={row.id}>
            <ListDetailTitle>{row.name}</ListDetailTitle>
          </ListDetailItem>
        ))}
      </ListDetailList>
      <ListDetailDetail>
        <ListDetailEmpty title="No student selected" description="Choose one from the list." />
      </ListDetailDetail>
    </ListDetail>
  );
}
```

### Page header with navigation

`PageHeader` has slots for the rows around the title. `back` takes a `PageHeaderBack` (a real link; `href`, or `asChild` with your router's `Link`; the label defaults to the localized "Back"), shown before `breadcrumbs`. `meta` is a wrapping row of status chips and short facts under the title block. `tabs` takes a `TabsNav` or `Tabs` list across the full width, closing the header with its divider. `sticky` keeps the whole header, tabs included, at the top of its scroll container on an opaque page background; `stickyOffset` (px or any CSS length) leaves room for a sticky bar above it.

```tsx region=page-header
export function ApplicantHeader() {
  return (
    <PageHeader
      sticky
      back={<PageHeaderBack href="/applicants" />}
      meta={
        <>
          <Chip tone="warning">In review</Chip>
          <span>Grade 3 admission</span>
        </>
      }
      tabs={
        <TabsNav aria-label="Applicant sections" value="overview">
          <TabsNavLink value="overview" href="#overview">
            Overview
          </TabsNavLink>
          <TabsNavLink value="documents" href="#documents" count={4}>
            Documents
          </TabsNavLink>
        </TabsNav>
      }
    >
      <PageHeaderTitle>Ana Torres</PageHeaderTitle>
      <PageHeaderActions>
        <Button>Approve</Button>
      </PageHeaderActions>
    </PageHeader>
  );
}
```

### Page with a side rail

`Page` takes an `aside` (usually an `Aside`) and lays the page out as a content column plus a rail, 20rem wide by default (`asideWidth`: pixels or any CSS length). The rail has a divider and the page background; `asideSticky` keeps it in view and scrolls it on its own beside the content. Page is the `page` container for the whole split and the rail does not change the width it measures, so a `Cols` or `SettingsLayout` in the content reacts the same with or without a rail, and an app that owns the page gutter on the content column gets the same gutter either way. Once the page is 1000px wide or less the rail falls under the content with a top divider. With an `aside`, `className` and `style` go to the content column. `Page` adds no outer padding or scrolling: the shell owns both.

```tsx region=page-aside
export function Applicant() {
  return (
    <Page
      aside={
        <Aside className="px-4">
          <AsideHeader title="Related" />
          <p>Notes and shortcuts.</p>
        </Aside>
      }
    >
      <PageHeader>
        <PageHeaderTitle>Ana Torres</PageHeaderTitle>
      </PageHeader>
      <Section title="Guardians">Rosa Quispe</Section>
    </Page>
  );
}
```

### Record header

`DetailHeader` is the header of a record screen (an applicant, a person, a student): `avatar`, the `name` as a heading (`headingLevel`, default 2, the level under the page's `h1`), `status` beside it, a `subtitle`, `actions` and a `facts` row, usually a `Facts` list. The status and the buttons wrap under the name when the header's own width is 480px or less. It heads the record, not the page: keep the page title in `PageHeader`. `Avatar` only has two sizes, so pass `className="size-14"` for a larger picture.

```tsx region=detail-header
export function ApplicantRecord() {
  return (
    <DetailHeader
      name="Ana Torres"
      subtitle="Applicant 2041 · Grade 3"
      avatar={<Avatar name="Ana Torres" size="lg" className="size-14" />}
      status={<Chip tone="warning">In review</Chip>}
      actions={<Button>Approve</Button>}
      facts={
        <Facts>
          <div>
            <dt>Guardian</dt>
            <dd>Rosa Quispe</dd>
          </div>
          <div>
            <dt>Applied</dt>
            <dd>12 Oct 2026</dd>
          </div>
        </Facts>
      }
    />
  );
}
```

### Tables, parts and statuses

`Table` can sit flush with the container edge (`flush`), keep its header in view (`stickyHeader` with a `maxHeight`, which makes the wrapper focusable for keyboard scrolling) and select rows. Selection is on as soon as one of `selectedKeys`, `defaultSelectedKeys` or `onSelectedKeysChange` is set: rows with a `rowKey` report `aria-selected`, the select-all box is checked, mixed or unchecked from the keys on screen, and checkboxes are named from the localized `selectRow` and `selectAll` strings. `TableActionsCell` wraps its inline actions under 48rem of the table's own container; pass `menu` (your overflow `DropdownMenu`) to swap them for it instead. Give an actions header column hidden text so it has a name.

```tsx region=table
export function Students({ rows }: { rows: { id: string; name: string }[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <Table
      aria-label="Students"
      flush
      stickyHeader
      maxHeight="20rem"
      selectedKeys={selected}
      onSelectedKeysChange={setSelected}
    >
      <TableHead>
        <TableRow>
          <TableSelectAllCell rowKeys={rows.map((row) => row.id)} />
          <TableHeaderCell>Name</TableHeaderCell>
          <TableHeaderCell>
            <span className="sr-only">Actions</span>
          </TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id} rowKey={row.id}>
            <TableSelectCell rowKey={row.id} label={row.name} />
            <TableCell>{row.name}</TableCell>
            <TableActionsCell
              menu={
                <Button size="sm" variant="ghost" aria-label="Row actions">
                  ...
                </Button>
              }
            >
              <Button size="sm">Charge</Button>
              <Button size="sm" variant="ghost">
                Open file
              </Button>
            </TableActionsCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

`Section`, `Kpi`, `Timeline` and `Stepper` accept parts or statuses next to their props. A `Section` with no title (a layout wrapper) takes no heading level, so the titled sections inside it keep the level they would have had. `Kpi` `trailing` and `Kpi.Label trailing` stay exposed to assistive tech, unlike `icon`.

```tsx region=parts
export function Parts() {
  return (
    <>
      <Section divider>
        <Section.Header>
          <Section.Title>Guardians</Section.Title>
          <Section.Count>2</Section.Count>
          <Section.Actions>
            <Button size="sm">Add</Button>
          </Section.Actions>
        </Section.Header>
        <Section.Body>
          <Note>Contacts are verified yearly.</Note>
        </Section.Body>
      </Section>
      <Kpi card tone="success" dot>
        <Kpi.Label
          trailing={
            <Button size="sm" variant="ghost">
              Details
            </Button>
          }
        >
          Collected
        </Kpi.Label>
        <Kpi.Value mono suffix="/ 1,200">
          840
        </Kpi.Value>
        <Kpi.Description>3 pending</Kpi.Description>
      </Kpi>
      <Timeline aria-label="Admission">
        <Timeline.Item title="Applied" status="done" />
        <Timeline.Item title="Interview" status="current" />
        <Timeline.Item title="Decision" status="pending" />
      </Timeline>
      <Stepper
        aria-label="Steps"
        currentStepId="docs"
        steps={[
          { id: "data", label: "Data", status: "done" },
          { id: "docs", label: "Documents" },
          { id: "pay", label: "Payment", status: "error" },
        ]}
      />
    </>
  );
}
```

### Custom menus and compound alert dialogs

`DropdownMenuContent` takes `bare`: only the layering and size limits stay, so you draw the surface yourself. Items are the same `DropdownMenuItem` (use `asChild` for links), `DropdownMenuAnchor` positions the menu against a larger element than the trigger, and `dropdownMenuItemClasses` gives a hand-made item the default look. `AlertDialog.Root` composes the same alertdialog from parts; use the props API when the confirm is async and needs a pending state.

```tsx region=custom-menu
export function UserMenu() {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuAnchor asChild>
        <div className="flex items-center gap-2 p-2">
          <span>Ana Torres</span>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label="Account menu">
              ...
            </button>
          </DropdownMenuTrigger>
        </div>
      </DropdownMenuAnchor>
      <DropdownMenuContent
        bare
        side="top"
        align="start"
        className="w-64 rounded-lg border border-line bg-surface"
      >
        <div className="px-3 py-2.5">ana@school.test</div>
        <DropdownMenuItem asChild>
          <a href="/profile" className={dropdownMenuItemClasses}>
            Profile
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function RemoveStudent({ onRemove }: { onRemove: () => void }) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>
        <Button variant="danger">Remove</Button>
      </AlertDialog.Trigger>
      <AlertDialog.Content>
        <AlertDialog.Header>
          <AlertDialog.Title>Remove this student?</AlertDialog.Title>
          <AlertDialog.Description>Their grades are archived.</AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
          <AlertDialog.Cancel />
          <AlertDialog.Action tone="danger" onClick={onRemove}>
            Remove
          </AlertDialog.Action>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
```

## States

`Skeleton` has the variants `list`, `kpis`, `key-value` and `bar` with a `count` (default 4, max 12); each renders one status region and hides its bars from assistive technology. `EmptyState` takes an `icon` node or one of `"inbox"`, `"search"` and `"lock"`, and `size="sm"` renders the inline one-row form for a list, a table cell or a card body (a muted sentence with an optional action). `ErrorState` accepts an `actions` node rendered in the same wrapping row as the retry button. `RadioGroup` radios are now named from their labels and described by their descriptions.

```tsx region=states
export function States({ onRetry }: { onRetry: () => void }) {
  return (
    <>
      <Skeleton variant="list" count={5} />
      <Skeleton variant="kpis" count={3} />
      <EmptyState icon="search" title="No results" description="Try another term." />
      <EmptyState size="sm" icon="inbox" title="No pending payments" />
      <ErrorState onRetry={onRetry} actions={<Button variant="ghost">Contact support</Button>} />
    </>
  );
}
```

## Behavior changes to know about

- `ErrorState` renders the retry button inside a wrapper `div` together with `actions`. Selectors that targeted the button as a direct child need updating.
- Success and error toasts are tinted with their tone instead of the inverted neutral look. `default` is unchanged.
- `Checkbox` and `Switch` draw the 44px touch target as an invisible `::after` of the control, so under touch density their layout box stays 40px (it was 44px). The target can overlap a neighbour by 2px per side.
- A `Section` without a title no longer consumes a heading level or tightens nested spacing.
- `ListDetail` calls `onBack` for the back action and never emits `null` through `onValueChange`.
- `Section` `divider` defaults to off. Kits whose section header always drew a hairline need `divider`.
