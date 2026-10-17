import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fireEvent, screen, userEvent, waitFor, within } from "storybook/test";
import { Button } from "../../atoms/button/button.js";
import { UiStringsProvider } from "../../i18n/index.js";
import { Tooltip } from "./tooltip.js";

const meta = {
  title: "Overlays/Tooltip",
  component: Tooltip,
  tags: ["autodocs"],
  args: { content: "Save changes", openDelay: 50, closeDelay: 0, children: <Button>Save</Button> },
  argTypes: {
    side: { control: "inline-radio", options: ["top", "right", "bottom", "left"] },
    align: { control: "inline-radio", options: ["start", "center", "end"] },
    openDelay: { control: { type: "number", min: 0, step: 50 } },
    closeDelay: { control: { type: "number", min: 0, step: 50 } },
    children: { control: false },
    open: { control: false },
    onOpenChange: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="flex min-h-40 w-full items-center justify-center">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", { name: "Save" });
    await userEvent.hover(trigger);
    const tip = await screen.findByRole("tooltip");
    await expect(tip).toHaveTextContent("Save changes");
    await expect(trigger).toHaveAttribute("aria-describedby", tip.id);
    await userEvent.unhover(trigger);
    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
    await expect(trigger).not.toHaveAttribute("aria-describedby");
  },
};

export const WithShortcut: Story = {
  args: { content: "Search", shortcut: "⌘K", children: <Button>Search</Button> },
};

export const Sides: Story = {
  render: (args) => (
    <div className="flex gap-6">
      {(["top", "right", "bottom", "left"] as const).map((side) => (
        <Tooltip key={side} {...args} side={side} defaultOpen content={`Side ${side}`}>
          <Button>{side}</Button>
        </Tooltip>
      ))}
    </div>
  ),
};

export const OpensOnKeyboardFocusAndClosesOnEscape: Story = {
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", { name: "Save" });
    await userEvent.tab();
    await expect(trigger).toHaveFocus();
    await screen.findByRole("tooltip");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
    await expect(trigger).toHaveFocus();
  },
};

export const WaitsForTheOpenDelay: Story = {
  args: { openDelay: 400 },
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", { name: "Save" });
    await userEvent.hover(trigger);
    await expect(screen.queryByRole("tooltip")).toBeNull();
    await screen.findByRole("tooltip");
  },
};

export const PressClosesAndDoesNotReopen: Story = {
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", { name: "Save" });
    await userEvent.hover(trigger);
    await screen.findByRole("tooltip");
    await userEvent.click(trigger);
    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
    await new Promise((resolve) => setTimeout(resolve, 150));
    await expect(screen.queryByRole("tooltip")).toBeNull();
  },
};

export const TouchNeverOpensByHover: Story = {
  args: { openDelay: 0 },
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", { name: "Save" });
    await fireEvent.pointerEnter(trigger, { pointerType: "touch" });
    await new Promise((resolve) => setTimeout(resolve, 100));
    await expect(screen.queryByRole("tooltip")).toBeNull();
  },
};

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", { name: "Save" });
    await userEvent.hover(trigger);
    await new Promise((resolve) => setTimeout(resolve, 150));
    await expect(screen.queryByRole("tooltip")).toBeNull();
  },
};

export const Controlled: Story = {
  render: (args) => {
    const [open, setOpen] = useState(false);
    return (
      <div className="flex flex-col items-center gap-3">
        <Tooltip {...args} open={open} onOpenChange={setOpen}>
          <Button>Hover me</Button>
        </Tooltip>
        <span className="text-ink-3 text-meta">open: {String(open)}</span>
      </div>
    );
  },
};

export const InSpanish: Story = {
  render: (args) => (
    <UiStringsProvider locale="es">
      <Tooltip {...args} content="Guardar cambios" shortcut="Ctrl+S">
        <Button>Guardar</Button>
      </Tooltip>
    </UiStringsProvider>
  ),
};
