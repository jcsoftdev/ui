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
} from "@jcsoftdev/ui/containers";
import { ChipGroup, Combobox, DatePicker, DateTimePicker, Field, SelectMenu } from "@jcsoftdev/ui/forms";
import { TabsNav, TabsNavLink, Wizard } from "@jcsoftdev/ui/navigation";
import { AlertDialog, toast, Tooltip } from "@jcsoftdev/ui/overlays";
import { ErrorState, Skeleton } from "@jcsoftdev/ui/states";
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
      <ErrorState onRetry={onRetry} actions={<Button variant="ghost">Contact support</Button>} />
    </>
  );
}
// #endregion
