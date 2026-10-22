import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { Calendar, Users } from "../../icons/index.js";
import { Shortcuts, ShortcutsItem } from "./shortcuts.js";

const onNew = fn();

const meta = {
  title: "Containers/Shortcuts",
  component: Shortcuts,
  tags: ["autodocs"],
  args: {
    "aria-label": "Quick links",
    children: (
      <>
        <ShortcutsItem href="#students" icon={<Users />} kbd="G S">
          Students
        </ShortcutsItem>
        <ShortcutsItem href="#calendar" icon={<Calendar />} count={4}>
          Calendar
        </ShortcutsItem>
      </>
    ),
  },
  argTypes: { children: { control: false } },
  decorators: [
    (Story) => (
      <div className="w-64">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Shortcuts>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = canvas.getByRole("link", { name: /Students/ });
    await expect(link).toHaveAttribute("href", "#students");
    await expect(link.querySelector("kbd")).toHaveTextContent("G S");
    await expect(canvas.getByRole("link", { name: /Calendar/ })).toHaveTextContent("4");
    await expect(getComputedStyle(canvas.getByRole("list")).paddingInlineStart).toBe("0px");
  },
};

export const ActionsAreButtons: Story = {
  args: { children: null },
  render: () => (
    <Shortcuts aria-label="Actions">
      <ShortcutsItem icon={<Users />} onClick={onNew}>
        New student
      </ShortcutsItem>
    </Shortcuts>
  ),
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: "New student" });
    await userEvent.click(button);
    await expect(onNew).toHaveBeenCalledTimes(1);
  },
};

export const AsChildWithRouterLink: Story = {
  args: { children: null },
  render: () => (
    <Shortcuts aria-label="Quick links">
      <ShortcutsItem asChild icon={<Users />} kbd="G S">
        <a href="/students" data-router="yes">
          Students
        </a>
      </ShortcutsItem>
    </Shortcuts>
  ),
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole("link", { name: /Students/ });
    await expect(link).toHaveAttribute("data-router", "yes");
    await expect(link).toHaveAttribute("href", "/students");
    await expect(link.querySelector("kbd")).toHaveTextContent("G S");
    await expect(link.querySelectorAll("a")).toHaveLength(0);
  },
};
