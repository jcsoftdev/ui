// Type-checks the examples in site/src/content/docs/docs/blocks.md against the built package.
// Every ```tsx block in that page must equal one `#region` below (see test/docs-examples.mjs).
import { Button, Chip, DueChip, IconButton, Kbd, Seal, Spinner } from "@jcsoftdev/ui/atoms";
import {
  Aside,
  AsideHeader,
  Banner,
  DescriptionList,
  DescriptionListItem,
  Feed,
  FeedEvent,
  Kpi,
  ListDetail,
  ListDetailDetail,
  ListDetailDetailHeader,
  ListDetailItem,
  ListDetailList,
  ListDetailTitle,
  Note,
  Section,
  Shortcuts,
  ShortcutsItem,
  Table,
  TableActionsCell,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  TableSelectAllCell,
  TableSelectCell,
  Timeline,
} from "@jcsoftdev/ui/containers";
import {
  ChipGroup,
  Combobox,
  DatePicker,
  DateTimePicker,
  Field,
  Fieldset,
  Form,
  FormFooter,
  FormGrid,
  FormGridItem,
  FormSection,
  Input,
  SelectMenu,
  Textarea,
} from "@jcsoftdev/ui/forms";
import { Stepper, TabsNav, TabsNavLink, Wizard } from "@jcsoftdev/ui/navigation";
import {
  AlertDialog,
  DropdownMenu,
  DropdownMenuAnchor,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  dropdownMenuItemClasses,
  toast,
  Tooltip,
} from "@jcsoftdev/ui/overlays";
import { EmptyState, ErrorState, Skeleton } from "@jcsoftdev/ui/states";
import { DateCalendar } from "@jcsoftdev/ui/calendar";
import { useState } from "react";

// #region atoms
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
// #endregion

// #region overlays
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
// #endregion

// #region testing
import { resetToasts } from "@jcsoftdev/ui/overlays/testing";

export function afterEachTest() {
  resetToasts();
}
// #endregion

// #region forms
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
// #endregion

// #region form-layout
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
// #endregion

// #region wizard
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
// #endregion

// #region containers
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
// #endregion

// #region states
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
// #endregion

// #region table
export function Students({ rows }: { rows: { id: string; name: string }[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <Table aria-label="Students" flush stickyHeader maxHeight="20rem" selectedKeys={selected} onSelectedKeysChange={setSelected}>
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
            <TableActionsCell menu={<Button size="sm" variant="ghost" aria-label="Row actions">...</Button>}>
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
// #endregion

// #region parts
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
        <Kpi.Label trailing={<Button size="sm" variant="ghost">Details</Button>}>Collected</Kpi.Label>
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
// #endregion

// #region custom-menu
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
      <DropdownMenuContent bare side="top" align="start" className="w-64 rounded-lg border border-line bg-surface">
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
// #endregion
