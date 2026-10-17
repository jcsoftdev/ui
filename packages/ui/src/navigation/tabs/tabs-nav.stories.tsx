import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { TabsNav, TabsNavLink } from "./tabs-nav.js";

const meta = {
  title: "Navigation/TabsNav",
  component: TabsNav,
  tags: ["autodocs"],
  args: {
    "aria-label": "Student sections",
    value: "grades",
    children: (
      <>
        <TabsNavLink value="summary" href="#summary">
          Summary
        </TabsNavLink>
        <TabsNavLink value="grades" href="#grades" count={8}>
          Grades
        </TabsNavLink>
        <TabsNavLink value="attendance" href="#attendance">
          Attendance
        </TabsNavLink>
      </>
    ),
  },
  argTypes: { children: { control: false } },
} satisfies Meta<typeof TabsNav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nav = canvas.getByRole("navigation", { name: "Student sections" });
    await expect(canvas.getAllByRole("link")).toHaveLength(3);
    await expect(canvas.getByRole("link", { name: /Grades/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(canvas.getByRole("link", { name: "Summary" })).not.toHaveAttribute("aria-current");
    await expect(canvas.queryByRole("tablist")).toBeNull();
    await expect(canvas.queryByRole("tab")).toBeNull();
    // Flush to the container's inline edges.
    await expect(getComputedStyle(nav).paddingInlineStart).toBe("0px");
    await expect(getComputedStyle(nav.firstElementChild as Element).paddingInlineStart).toBe("0px");
  },
};

export const KeyboardUsesNativeLinks: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    await expect(canvas.getByRole("link", { name: "Summary" })).toHaveFocus();
    await userEvent.tab();
    await expect(canvas.getByRole("link", { name: /Grades/ })).toHaveFocus();
  },
};

export const AsChildWithRouterLink: Story = {
  args: { children: null },
  render: (args) => (
    <TabsNav {...args} value="b">
      <TabsNavLink value="a" asChild count={2}>
        <a href="/a" data-router="a">
          Alpha
        </a>
      </TabsNavLink>
      <TabsNavLink value="b" asChild>
        <a href="/b" data-router="b">
          Beta
        </a>
      </TabsNavLink>
    </TabsNav>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alpha = canvas.getByRole("link", { name: /Alpha/ });
    await expect(alpha).toHaveAttribute("data-router", "a");
    await expect(alpha).toHaveTextContent("Alpha2");
    await expect(alpha.querySelectorAll("a")).toHaveLength(0);
    await expect(canvas.getByRole("link", { name: "Beta" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  },
};

export const RenderLink: Story = {
  args: { children: null },
  render: (args) => (
    <TabsNav
      {...args}
      value="b"
      renderLink={({ children, ...props }) => (
        <a {...props} data-custom="yes">
          {children}
        </a>
      )}
    >
      <TabsNavLink value="a" href="/a">
        Alpha
      </TabsNavLink>
      <TabsNavLink value="b" href="/b">
        Beta
      </TabsNavLink>
    </TabsNav>
  ),
  play: async ({ canvasElement }) => {
    const links = within(canvasElement).getAllByRole("link");
    for (const link of links) await expect(link).toHaveAttribute("data-custom", "yes");
    await expect(links[1]).toHaveAttribute("aria-current", "page");
  },
};

export const ActiveOverride: Story = {
  args: { children: null, value: undefined },
  render: (args) => (
    <TabsNav {...args}>
      <TabsNavLink value="a" href="/a">
        Alpha
      </TabsNavLink>
      <TabsNavLink value="b" href="/b" active>
        Beta
      </TabsNavLink>
    </TabsNav>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("link", { name: "Beta" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  },
};

function ClientRouted() {
  const [page, setPage] = useState("a");
  return (
    <TabsNav aria-label="Pages" value={page}>
      {["a", "b"].map((id) => (
        <TabsNavLink
          key={id}
          value={id}
          href={`#${id}`}
          onClick={(event) => {
            event.preventDefault();
            setPage(id);
          }}
        >
          Page {id}
        </TabsNavLink>
      ))}
    </TabsNav>
  );
}

export const FollowsTheCurrentPage: Story = {
  render: () => <ClientRouted />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("link", { name: "Page b" }));
    await expect(canvas.getByRole("link", { name: "Page b" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(canvas.getByRole("link", { name: "Page a" })).not.toHaveAttribute("aria-current");
  },
};
