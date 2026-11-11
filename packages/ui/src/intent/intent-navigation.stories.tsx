import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ReactNode, useMemo, useState } from "react";
import { expect, waitFor, within } from "storybook/test";
import { Breadcrumbs } from "../navigation/breadcrumbs/breadcrumbs.js";
import { FloatingToc } from "../navigation/floating-toc/floating-toc.js";
import { Segmented, SegmentedItem } from "../navigation/segmented/segmented.js";
import { Stepper } from "../navigation/stepper/stepper.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../navigation/tabs/tabs.js";
import { TabsNav, TabsNavLink } from "../navigation/tabs/tabs-nav.js";
import { Wizard } from "../navigation/wizard/wizard.js";
import { BottomNav } from "../shell/bottom-nav/bottom-nav.js";
import { Sidebar } from "../shell/sidebar/sidebar.js";
import { IntentBridgeProvider } from "./bridge.js";
import type { IntentBridge } from "./types.js";

function RecordingBridge({ children }: { children: ReactNode }) {
  const [log, setLog] = useState<string[]>([]);
  const bridge = useMemo<IntentBridge>(
    () => ({
      registerTarget(ref, _element, expectation) {
        const entry = `${ref.intent}:${ref.key ?? ""}:${expectation.role}`;
        setLog((current) => [...current, entry]);
        return () => setLog((current) => current.filter((item) => item !== entry));
      },
    }),
    [],
  );
  return (
    <IntentBridgeProvider bridge={bridge}>
      {children}
      <output data-testid="log">{log.join("|")}</output>
    </IntentBridgeProvider>
  );
}

const meta = {
  title: "Intent/Navigation",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const logOf = (canvasElement: HTMLElement) => within(canvasElement).getByTestId("log");

export const TabsRegisterTabAndPanel: Story = {
  render: () => (
    <RecordingBridge>
      <Tabs defaultValue="today">
        <TabsList aria-label="Views">
          <TabsTrigger value="today" intent="tab-today" intentKey="t1">
            Today
          </TabsTrigger>
        </TabsList>
        <TabsContent value="today" intent="panel-today" intentKey="p1">
          Today panel
        </TabsContent>
      </Tabs>
    </RecordingBridge>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("tab", { name: "Today" })).toHaveAttribute(
      "data-intent",
      "tab-today",
    );
    await expect(canvas.getByRole("tabpanel", { name: "Today" })).toHaveAttribute(
      "data-intent-key",
      "p1",
    );
    await waitFor(() => {
      expect(logOf(canvasElement)).toHaveTextContent("tab-today:t1:tab");
      expect(logOf(canvasElement)).toHaveTextContent("panel-today:p1:tabpanel");
    });
  },
};

export const SegmentedRegistersItsRadios: Story = {
  render: () => (
    <RecordingBridge>
      <Segmented aria-label="Range" defaultValue="week">
        <SegmentedItem value="week" intent="range-week" intentKey="w">
          Week
        </SegmentedItem>
        <SegmentedItem value="month" intent="range-month" intentKey="m">
          Month
        </SegmentedItem>
      </Segmented>
    </RecordingBridge>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("radio", { name: "Month" })).toHaveAttribute(
      "data-intent",
      "range-month",
    );
    await waitFor(() => {
      expect(logOf(canvasElement)).toHaveTextContent("range-week:w:radio");
      expect(logOf(canvasElement)).toHaveTextContent("range-month:m:radio");
    });
  },
};

export const TabsNavRegistersItsLink: Story = {
  render: () => (
    <RecordingBridge>
      <TabsNav aria-label="Sections" value="guests">
        <TabsNavLink value="guests" href="/guests" intent="nav-guests" intentKey="g">
          Guests
        </TabsNavLink>
      </TabsNav>
    </RecordingBridge>
  ),
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole("link", { name: "Guests" });
    await expect(link).toHaveAttribute("data-intent", "nav-guests");
    await waitFor(() => expect(logOf(canvasElement)).toHaveTextContent("nav-guests:g:link"));
  },
};

export const BreadcrumbsRegisterLinkAndCurrent: Story = {
  render: () => (
    <RecordingBridge>
      <Breadcrumbs
        items={[
          { label: "Restaurants", href: "/restaurants", intent: "crumb-home", intentKey: "h" },
          { label: "La Mar", intent: "crumb-current", intentKey: "c" },
        ]}
      />
    </RecordingBridge>
  ),
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole("link", { name: "Restaurants" });
    await expect(link).toHaveAttribute("data-intent", "crumb-home");
    await waitFor(() => expect(logOf(canvasElement)).toHaveTextContent("crumb-home:h:link"));
  },
};

export const FloatingTocRegistersItsLinks: Story = {
  render: () => (
    <RecordingBridge>
      <FloatingToc
        title="On this page"
        items={[
          { id: "intro", label: "Intro", intent: "toc-intro", intentKey: "i" },
          { id: "menu", label: "Menu" },
        ]}
      />
    </RecordingBridge>
  ),
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole("link", { name: "Intro" });
    await expect(link).toHaveAttribute("data-intent", "toc-intro");
    await expect(within(canvasElement).getByRole("link", { name: "Menu" })).not.toHaveAttribute(
      "data-intent",
    );
    await waitFor(() => expect(logOf(canvasElement)).toHaveTextContent("toc-intro:i:link"));
  },
};

export const StepperMarksStepsWithoutRegistering: Story = {
  render: () => (
    <RecordingBridge>
      <Stepper
        aria-label="Progress"
        currentStepId="two"
        steps={[
          { id: "one", label: "Details", intent: "step-one" },
          { id: "two", label: "Payment", intent: "step-two", intentKey: "pay" },
        ]}
      />
    </RecordingBridge>
  ),
  play: async ({ canvasElement }) => {
    const items = within(canvasElement).getAllByRole("listitem");
    await expect(items[0]).toHaveAttribute("data-intent-key", "one");
    await expect(items[1]).toHaveAttribute("data-intent-key", "pay");
    await expect(logOf(canvasElement)).toHaveTextContent("");
  },
};

export const WizardRegistersItsSteps: Story = {
  render: () => (
    <RecordingBridge>
      <Wizard
        steps={[
          { id: "details", label: "Details", content: "Details form", intent: "wiz-details" },
          {
            id: "pay",
            label: "Payment",
            content: "Payment form",
            intent: "wiz-pay",
            intentKey: "p",
          },
        ]}
      />
    </RecordingBridge>
  ),
  play: async ({ canvasElement }) => {
    const steps = within(canvasElement).getAllByRole("listitem");
    await expect(steps[0]).toHaveAttribute("data-intent-key", "details");
    await waitFor(() => {
      expect(logOf(canvasElement)).toHaveTextContent("wiz-details:details:listitem");
      expect(logOf(canvasElement)).toHaveTextContent("wiz-pay:p:listitem");
    });
  },
};

const shellItems = [
  { id: "orders", label: "Orders", href: "/orders", intent: "nav-orders" },
  { id: "tables", label: "Tables", href: "/tables", intent: "nav-tables", intentKey: "floor" },
];

export const SidebarRegistersItsLinks: Story = {
  render: () => (
    <RecordingBridge>
      <Sidebar
        ariaLabel="Main"
        groups={[{ id: "main", label: "Operate", items: shellItems }]}
        open
      />
    </RecordingBridge>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      expect(logOf(canvasElement)).toHaveTextContent("nav-orders:orders:link");
      expect(logOf(canvasElement)).toHaveTextContent("nav-tables:floor:link");
    });
    await expect(within(canvasElement).getByRole("link", { name: "Orders" })).toHaveAttribute(
      "data-intent",
      "nav-orders",
    );
  },
};

export const BottomNavRegistersItsLinks: Story = {
  render: () => (
    <RecordingBridge>
      <BottomNav ariaLabel="Main" items={shellItems} />
    </RecordingBridge>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      expect(logOf(canvasElement)).toHaveTextContent("nav-orders:orders:link");
      expect(logOf(canvasElement)).toHaveTextContent("nav-tables:floor:link");
    });
    await expect(within(canvasElement).getByRole("link", { name: "Tables" })).toHaveAttribute(
      "data-intent-key",
      "floor",
    );
  },
};
