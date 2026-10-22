import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { UiStringsProvider } from "../../i18n/index.js";
import { DateCalendar } from "./date-calendar.js";

const meta = {
  title: "Calendar/DateCalendar",
  component: DateCalendar,
  tags: ["autodocs"],
  args: { value: "2026-09-07", today: "2026-09-10", onSelect: fn() },
  argTypes: { onSelect: { control: false }, isDateDisabled: { control: false } },
} satisfies Meta<typeof DateCalendar>;

export default meta;
type Story = StoryObj<typeof meta>;

const day = (canvas: ReturnType<typeof within>, date: string) =>
  canvas.getByRole("button", { name: new RegExp(`${Number(date.slice(8))}`) }).closest("td");

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("grid", { name: "September 2026" })).toBeVisible();
    const columns = canvas.getAllByRole("columnheader");
    // en-US starts the week on Sunday.
    await expect(columns[0]).toHaveAccessibleName("Sunday");
    const selected = canvasElement.querySelector('[data-date="2026-09-07"]') as HTMLElement;
    await expect(selected.closest("td")).toHaveAttribute("aria-selected", "true");
    await expect(selected).toHaveAccessibleName("Monday, September 7, 2026");
    await expect(canvasElement.querySelector('[data-date="2026-09-10"]')).toHaveAttribute(
      "aria-current",
      "date",
    );
    await userEvent.click(canvasElement.querySelector('[data-date="2026-09-15"]') as HTMLElement);
    await expect(args.onSelect).toHaveBeenCalledWith("2026-09-15");
    await expect(day(canvas, "2026-09-15")).toBeTruthy();
  },
};

export const SpanishStartsOnMonday: Story = {
  decorators: [
    (Story) => (
      <UiStringsProvider locale="es">
        <Story />
      </UiStringsProvider>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("grid", { name: /^Sep?tiembre de 2026$/ })).toBeVisible();
    await expect(canvas.getAllByRole("columnheader")[0]).toHaveAccessibleName("lunes");
    await expect(canvas.getByRole("button", { name: "Mes siguiente" })).toBeVisible();
    // 1 Sep 2026 is a Tuesday: one leading cell from August.
    const first = canvasElement.querySelector("tbody td button") as HTMLElement;
    await expect(first.dataset.date).toBe("2026-08-31");
  },
};

export const KeyboardGrid: Story = {
  play: async ({ canvasElement, args }) => {
    const focused = () => document.activeElement as HTMLElement;
    (canvasElement.querySelector('[data-date="2026-09-07"]') as HTMLElement).focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(focused().dataset.date).toBe("2026-09-08");
    await userEvent.keyboard("{ArrowDown}");
    await expect(focused().dataset.date).toBe("2026-09-15");
    await userEvent.keyboard("{ArrowLeft}{ArrowUp}");
    await expect(focused().dataset.date).toBe("2026-09-07");
    // Sunday-first week: Home is Sunday 6, End is Saturday 12.
    await userEvent.keyboard("{Home}");
    await expect(focused().dataset.date).toBe("2026-09-06");
    await userEvent.keyboard("{End}");
    await expect(focused().dataset.date).toBe("2026-09-12");
    await userEvent.keyboard("{PageDown}");
    await expect(focused().dataset.date).toBe("2026-10-12");
    await userEvent.keyboard("{Shift>}{PageUp}{/Shift}");
    await expect(focused().dataset.date).toBe("2025-10-12");
    // Only the focused day is a tab stop.
    await expect(canvasElement.querySelectorAll('td button[tabindex="0"]')).toHaveLength(1);
    await userEvent.keyboard("{Enter}");
    await expect(args.onSelect).toHaveBeenCalledWith("2025-10-12");
  },
};

export const MonthEndClamps: Story = {
  args: { value: "2026-01-31" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Next month" }));
    await expect(canvas.getByRole("grid", { name: "February 2026" })).toBeVisible();
    await expect(
      canvasElement.querySelector('td button[tabindex="0"]')?.getAttribute("data-date"),
    ).toBe("2026-02-28");
  },
};

export const MinMaxAndDisabledDates: Story = {
  args: {
    min: "2026-09-05",
    max: "2026-09-25",
    isDateDisabled: (date: string) => date === "2026-09-14",
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const dateButton = (date: string) =>
      canvasElement.querySelector(`[data-date="${date}"]`) as HTMLElement;
    for (const date of ["2026-09-04", "2026-09-26", "2026-09-14"]) {
      await expect(dateButton(date)).toHaveAttribute("aria-disabled", "true");
      await userEvent.click(dateButton(date));
    }
    await expect(args.onSelect).not.toHaveBeenCalled();
    await userEvent.click(dateButton("2026-09-05"));
    await expect(args.onSelect).toHaveBeenCalledWith("2026-09-05");
    // Keyboard movement stops at the bounds.
    dateButton("2026-09-05").focus();
    await userEvent.keyboard("{ArrowLeft}");
    await expect((document.activeElement as HTMLElement).dataset.date).toBe("2026-09-05");
    // September is the first and last month that can be shown.
    await waitFor(() =>
      expect(canvas.getByRole("button", { name: "Previous month" })).toBeDisabled(),
    );
    await expect(canvas.getByRole("button", { name: "Next month" })).toBeDisabled();
  },
};

export const Controlled: Story = {
  render: (args) => {
    const [value, setValue] = useState("2026-09-07");
    return (
      <div className="flex flex-col gap-2">
        <DateCalendar {...args} value={value} onSelect={setValue} />
        <p className="text-ink-3 text-meta">Picked: {value}</p>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(canvasElement.querySelector('[data-date="2026-09-20"]') as HTMLElement);
    await expect(within(canvasElement).getByText("Picked: 2026-09-20")).toBeVisible();
  },
};
