import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { UiStringsProvider } from "../../i18n/index.js";
import { DueChip } from "./due-chip.js";

const meta = {
  title: "Atoms/DueChip",
  component: DueChip,
  tags: ["autodocs"],
  args: { date: "2026-03-20", today: "2026-03-04" },
  argTypes: { soonDays: { control: { type: "number", min: 0 } } },
} satisfies Meta<typeof DueChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ok: Story = {
  play: async ({ canvasElement }) => {
    const chip = canvasElement.querySelector("[data-state]") as HTMLElement;
    await expect(chip).toHaveAttribute("data-state", "ok");
    await expect(within(chip).getByText("Mar 20")).toHaveAttribute("datetime", "2026-03-20");
    await expect(within(chip).queryByText(/Overdue|Due soon/)).toBeNull();
  },
};

export const Soon: Story = {
  args: { date: "2026-03-06" },
  play: async ({ canvasElement }) => {
    const chip = canvasElement.querySelector("[data-state]") as HTMLElement;
    await expect(chip).toHaveAttribute("data-state", "soon");
    await expect(within(chip).getByText(", Due soon")).toHaveClass("sr-only");
    await expect(chip.querySelector("svg")).not.toBeNull();
  },
};

export const DueToday: Story = {
  args: { date: "2026-03-04" },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("[data-state]")).toHaveAttribute("data-state", "soon");
  },
};

export const Overdue: Story = {
  args: { date: "2026-03-01" },
  play: async ({ canvasElement }) => {
    const chip = canvasElement.querySelector("[data-state]") as HTMLElement;
    await expect(chip).toHaveAttribute("data-state", "overdue");
    await expect(within(chip).getByText(", Overdue")).toBeInTheDocument();
  },
};

export const DoneIsNeverOverdue: Story = {
  args: { date: "2026-03-01", done: true },
  play: async ({ canvasElement }) => {
    const chip = canvasElement.querySelector("[data-state]") as HTMLElement;
    await expect(chip).toHaveAttribute("data-state", "done");
    await expect(within(chip).queryByText(/Overdue/)).toBeNull();
  },
};

export const SoonWindow: Story = {
  args: { date: "2026-03-10", soonDays: 7 },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("[data-state]")).toHaveAttribute("data-state", "soon");
  },
};

export const NaiveDateTimeAndYear: Story = {
  args: { date: "2027-01-05T17:30" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Jan 5, 2027")).toHaveAttribute(
      "datetime",
      "2027-01-05T17:30",
    );
  },
};

export const Spanish: Story = {
  args: { date: "2026-03-01" },
  render: (args) => (
    <UiStringsProvider locale="es">
      <DueChip {...args} />
    </UiStringsProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(", Vencido")).toBeInTheDocument();
    await expect(canvas.getByText(/1 mar/)).toBeInTheDocument();
  },
};

export const UnreadableDateIsShownAsGiven: Story = {
  args: { date: "next week" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("next week")).toBeInTheDocument();
    await expect(canvasElement.querySelector("time")).toBeNull();
  },
};

export const ForcedState: Story = {
  args: { date: "2026-03-20", today: "2026-03-04", state: "overdue" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(", Overdue")).toBeInTheDocument();
    await expect(canvasElement.querySelector("[data-state]")?.getAttribute("data-state")).toBe(
      "overdue",
    );
  },
};
