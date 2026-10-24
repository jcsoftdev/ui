import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { CalendarDays, Package, Scissors, Settings, Users } from "../icons/index.js";
import { BottomNav, type BottomNavRenderLink } from "./bottom-nav/bottom-nav.js";
import type { SidebarItem } from "./sidebar/index.js";

const meta = {
  title: "Tests/Shell",
  tags: ["!autodocs"],
  parameters: { layout: "centered" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const items: SidebarItem[] = [
  { id: "agenda", label: "Agenda", href: "#agenda", icon: <CalendarDays /> },
  { id: "clients", label: "Clients", href: "#clients", icon: <Users /> },
  { id: "services", label: "Services", href: "#services", icon: <Scissors /> },
  { id: "stock", label: "Stock", href: "#stock", icon: <Package /> },
  { id: "settings", label: "Settings", href: "#settings", icon: <Settings /> },
  { id: "billing", label: "Billing", href: "#billing", icon: <Package />, active: true },
];

const staticLink: BottomNavRenderLink = ({ href, children, ...props }) => (
  <button type="button" data-href={href} {...props}>
    {children}
  </button>
);

export const BottomNavMoreDrawer: Story = {
  render: () => (
    <BottomNav
      items={items}
      ariaLabel="Sections"
      renderLink={staticLink}
      moreFooter={<span>Account</span>}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const more = canvas.getByRole("button", { name: "More" });
    await expect(more).toHaveAttribute("aria-expanded", "false");
    await expect(more).toHaveAttribute("data-active", "true");
    await expect(canvas.queryByRole("button", { name: "Billing" })).not.toBeInTheDocument();

    await userEvent.click(more);
    const drawer = within(await within(document.body).findByRole("dialog", { name: "More" }));
    await expect(more).toHaveAttribute("aria-expanded", "true");
    await expect(drawer.getByRole("button", { name: "Settings" })).toBeInTheDocument();
    await expect(drawer.getByRole("button", { name: "Billing" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(drawer.getByText("Account")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(within(document.body).queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(more).toHaveFocus());
  },
};

export const BottomNavLinkClosesDrawer: Story = {
  render: () => <BottomNav items={items} ariaLabel="Sections" renderLink={staticLink} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "More" }));
    const drawer = within(await within(document.body).findByRole("dialog", { name: "More" }));
    await userEvent.click(drawer.getByRole("button", { name: "Settings" }));
    await waitFor(() =>
      expect(within(document.body).queryByRole("dialog")).not.toBeInTheDocument(),
    );
  },
};
