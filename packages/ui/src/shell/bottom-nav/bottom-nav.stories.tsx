import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ComponentProps, ReactNode } from "react";
import { expect, userEvent, within } from "storybook/test";
import { Button } from "../../atoms/button/button.js";
import { CalendarDays, Package, Scissors, Settings, Users } from "../../icons/index.js";
import { AppShell } from "../app-shell/index.js";
import type { SidebarItem } from "../sidebar/index.js";
import { BottomNav } from "./bottom-nav.js";

const items: SidebarItem[] = [
  { id: "agenda", label: "Agenda", href: "#agenda", icon: <CalendarDays />, active: true },
  { id: "clients", label: "Clients", href: "#clients", icon: <Users /> },
  {
    id: "services",
    label: "Services",
    href: "#services",
    icon: <Scissors />,
    badge: 2,
    badgeLabel: "pending",
  },
  { id: "stock", label: "Stock", href: "#stock", icon: <Package /> },
  { id: "settings", label: "Settings", href: "#settings", icon: <Settings /> },
  { id: "billing", label: "Billing", href: "#billing", icon: <Package /> },
];

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="h-[560px] w-[375px] max-w-full overflow-y-auto [transform:translateZ(0)]">
      {children}
    </div>
  );
}

const meta = {
  title: "Shell/BottomNav",
  component: BottomNav,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: { items, ariaLabel: "Sections" },
  argTypes: { items: { control: false }, maxSlots: { control: "number" } },
} satisfies Meta<typeof BottomNav>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Four items plus "More", which opens the rest in a drawer. The bar hides once the shell is 900 px wide. */
export const Default: Story = {
  render: (args) => (
    <Frame>
      <AppShell className="min-h-full flex-col">
        <main className="flex-1 p-4 text-ink">
          <h1 className="font-bold text-lg">Agenda</h1>
        </main>
        <BottomNav {...args} moreFooter={<Button block>Sign out</Button>} />
      </AppShell>
    </Frame>
  ),
};

/** At most five items: all fit and there is no "More". */
export const NoOverflow: Story = {
  render: (args) => (
    <Frame>
      <AppShell className="min-h-full flex-col">
        <main className="flex-1 p-4 text-ink" />
        <BottomNav {...args} items={items.slice(0, 5)} />
      </AppShell>
    </Frame>
  ),
};

const badgedItems: SidebarItem[] = [
  { id: "agenda", label: "Agenda", href: "#agenda", icon: <CalendarDays />, active: true },
  {
    id: "clients",
    label: "Clients",
    href: "#clients",
    icon: <Users />,
    badge: 7,
    badgeLabel: "new",
  },
  {
    id: "services",
    label: "Services",
    href: "#services",
    icon: <Scissors />,
    badge: 120,
    badgeTone: "danger",
  },
  { id: "stock", label: "Stock", href: "#stock", icon: <Package /> },
  { id: "settings", label: "Settings", href: "#settings", icon: <Settings />, badge: 3 },
  { id: "billing", label: "Billing", href: "#billing", icon: <Package />, badge: 4 },
];

function badgeFrame(args: ComponentProps<typeof BottomNav>) {
  return (
    <Frame>
      <AppShell className="min-h-full flex-col">
        <main className="flex-1 p-4 text-ink" />
        <BottomNav {...args} />
      </AppShell>
    </Frame>
  );
}

/** Numeric badges show as count chips on the icon, capped at 99+. */
export const NumericBadges: Story = {
  args: { items: badgedItems, maxSlots: 6 },
  render: badgeFrame,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("7", { selector: "[aria-hidden=true]" })).toBeInTheDocument();
    await expect(canvas.getByText("99+")).toBeInTheDocument();
    await expect(canvas.getByText("new")).toBeInTheDocument();
  },
};

/** The badges of the items behind "More" are summed on the button. */
export const OverflowBadgesSumOnMore: Story = {
  args: { items: badgedItems },
  render: badgeFrame,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const more = canvas.getByRole("button", { name: "More 7 pending" });
    await expect(
      within(more).getByText("7", { selector: "[aria-hidden=true]" }),
    ).toBeInTheDocument();
    await userEvent.click(more);
  },
};

/** `badgeStyle="dot"` keeps the previous small dots. */
export const DotBadges: Story = {
  args: { items: badgedItems, badgeStyle: "dot" },
  render: badgeFrame,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText("99+")).not.toBeInTheDocument();
    await expect(
      canvas.queryByText("7", { selector: "[aria-hidden=true]" }),
    ).not.toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "More 7 pending" })).toBeInTheDocument();
  },
};
