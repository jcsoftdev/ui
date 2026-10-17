import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import { UiStringsProvider } from "../../i18n/index.js";
import { Field } from "../field/field.js";
import { DatePicker } from "./date-picker.js";
import { DateTimePicker } from "./date-time-picker.js";

const meta = {
  title: "Forms/DatePicker",
  component: DatePicker,
  tags: ["autodocs"],
  args: { "aria-label": "Start date", onValueChange: fn() },
  argTypes: {
    disabled: { control: "boolean" },
    invalid: { control: "boolean" },
    clearable: { control: "boolean" },
    onValueChange: { control: false },
    isDateDisabled: { control: false },
  },
  decorators: [
    (Story) => (
      <UiStringsProvider locale="es">
        <div className="max-w-xs">
          <Story />
        </div>
      </UiStringsProvider>
    ),
  ],
} satisfies Meta<typeof DatePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

const field = (canvas: ReturnType<typeof within>) =>
  canvas.getByRole("textbox", { name: "Start date" });
const dialog = () => screen.findByRole("dialog", { name: "Calendario" });

export const Default: Story = {
  args: { defaultValue: "2026-09-07" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // es-PE writes day first.
    await expect(field(canvas)).toHaveValue("07/09/2026");
    await userEvent.clear(field(canvas));
    await expect(field(canvas)).toHaveAttribute("placeholder", "dd/mm/aaaa");
  },
};

export const EnglishWritesMonthFirst: Story = {
  args: { defaultValue: "2026-09-07" },
  decorators: [
    (Story) => (
      <UiStringsProvider locale="en">
        <Story />
      </UiStringsProvider>
    ),
  ],
  play: async ({ canvasElement }) => {
    await expect(field(within(canvasElement))).toHaveValue("09/07/2026");
  },
};

export const TypingCommitsOnlyRealDates: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(field(canvas));
    await userEvent.keyboard("3102");
    await expect(field(canvas)).toHaveValue("31/02");
    await userEvent.keyboard("2026");
    await expect(field(canvas)).toHaveValue("31/02/2026");
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.tab();
    // An incomplete or impossible draft is discarded on blur.
    await expect(field(canvas)).toHaveValue("");
    await userEvent.click(field(canvas));
    await userEvent.keyboard("15092026");
    await expect(args.onValueChange).toHaveBeenCalledWith("2026-09-15");
    await expect(field(canvas)).toHaveValue("15/09/2026");
    await userEvent.clear(field(canvas));
    await expect(args.onValueChange).toHaveBeenLastCalledWith("");
  },
};

export const PickFromCalendarWithKeyboard: Story = {
  args: { defaultValue: "2026-09-07" },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(field(canvas));
    await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}");
    const panel = await dialog();
    const focused = () => document.activeElement as HTMLElement;
    await waitFor(() => expect(focused().dataset.date).toBe("2026-09-07"));
    await expect(within(panel).getAllByRole("columnheader")[0]).toHaveAccessibleName("lunes");
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    await userEvent.keyboard("{Enter}");
    await expect(args.onValueChange).toHaveBeenCalledWith("2026-09-09");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await expect(field(canvas)).toHaveValue("09/09/2026");
    await expect(field(canvas)).toHaveFocus();
  },
};

export const EscapeClosesWithoutChange: Story = {
  args: { defaultValue: "2026-09-07" },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Abrir calendario" }));
    await dialog();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(field(canvas)).toHaveFocus();
  },
};

export const MinMaxAndDisabledDates: Story = {
  args: {
    defaultValue: "2026-09-10",
    min: "2026-09-05",
    max: "2026-09-25",
    isDateDisabled: (date) => date === "2026-09-14",
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.clear(field(canvas));
    await userEvent.keyboard("01092026");
    // Outside the range: not committed, flagged invalid.
    await expect(args.onValueChange).toHaveBeenLastCalledWith("");
    await expect(field(canvas)).toHaveAttribute("aria-invalid", "true");
    await userEvent.clear(field(canvas));
    await userEvent.keyboard("14092026");
    await expect(field(canvas)).toHaveAttribute("aria-invalid", "true");
    await userEvent.clear(field(canvas));
    await userEvent.keyboard("20092026");
    await expect(args.onValueChange).toHaveBeenLastCalledWith("2026-09-20");
    await expect(field(canvas)).not.toHaveAttribute("aria-invalid");
    await userEvent.click(canvas.getByRole("button", { name: "Abrir calendario" }));
    const panel = await dialog();
    const cell = (date: string) => panel.querySelector(`[data-date="${date}"]`) as HTMLElement;
    await expect(cell("2026-09-04")).toHaveAttribute("aria-disabled", "true");
    await expect(cell("2026-09-14")).toHaveAttribute("aria-disabled", "true");
    await expect(cell("2026-09-26")).toHaveAttribute("aria-disabled", "true");
    await expect(cell("2026-09-15")).not.toHaveAttribute("aria-disabled");
  },
};

export const Clearable: Story = {
  args: { defaultValue: "2026-09-07" },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Limpiar" }));
    await expect(args.onValueChange).toHaveBeenCalledWith("");
    await expect(field(canvas)).toHaveValue("");
    await expect(canvas.queryByRole("button", { name: "Limpiar" })).toBeNull();
    await expect(field(canvas)).toHaveFocus();
  },
};

export const InsideFieldAndForm: Story = {
  render: (args) => (
    <form data-testid="form">
      <Field label="Start date" hint="First class" error="Required">
        <DatePicker {...args} name="start" aria-label={undefined} />
      </Field>
    </form>
  ),
  args: { defaultValue: "2026-09-07" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const control = field(canvas);
    await expect(control).toHaveAccessibleDescription(/First class.*Required/);
    await expect(control).toHaveAttribute("aria-invalid", "true");
    const form = canvas.getByTestId("form") as HTMLFormElement;
    await expect(new FormData(form).get("start")).toBe("2026-09-07");
  },
};

export const Controlled: Story = {
  render: (args) => {
    const [value, setValue] = useState("2026-09-07");
    return (
      <div className="flex flex-col gap-2">
        <DatePicker {...args} value={value} onValueChange={setValue} />
        <p className="text-ink-3 text-meta">Value: {value || "none"}</p>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Abrir calendario" }));
    const panel = await dialog();
    await userEvent.click(panel.querySelector('[data-date="2026-09-21"]') as HTMLElement);
    await expect(canvas.getByText("Value: 2026-09-21")).toBeVisible();
  },
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: "2026-09-07" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(field(canvas)).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "Abrir calendario" })).toBeDisabled();
  },
};

export const DateTime: Story = {
  render: () => {
    const [value, setValue] = useState("");
    return (
      <form data-testid="form" className="flex flex-col gap-2">
        <DateTimePicker
          aria-label="Appointment"
          name="when"
          min="2026-09-05T08:00"
          max="2026-09-25"
          value={value}
          onValueChange={setValue}
        />
        <p className="text-ink-3 text-meta">Value: {value || "none"}</p>
      </form>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const date = canvas.getByRole("textbox", { name: "Appointment" });
    const time = canvas.getByRole("textbox", { name: "Appointment, Hora" });
    await userEvent.type(date, "07092026");
    // One half is not a value yet.
    await expect(canvas.getByText("Value: none")).toBeVisible();
    await userEvent.type(time, "0930");
    await expect(canvas.getByText("Value: 2026-09-07T09:30")).toBeVisible();
    const form = canvas.getByTestId("form") as HTMLFormElement;
    await expect(new FormData(form).get("when")).toBe("2026-09-07T09:30");
    // Before the minimum time on the first allowed day: the pair is dropped and flagged.
    await userEvent.clear(date);
    await userEvent.type(date, "05092026");
    await expect(canvas.getByText("Value: 2026-09-05T09:30")).toBeVisible();
    await userEvent.clear(time);
    await userEvent.type(time, "0730");
    await expect(canvas.getByText("Value: none")).toBeVisible();
    await expect(time).toHaveAttribute("aria-invalid", "true");
    await userEvent.clear(time);
    await userEvent.type(time, "0800");
    await expect(canvas.getByText("Value: 2026-09-05T08:00")).toBeVisible();
    await expect(time).not.toHaveAttribute("aria-invalid");
  },
};

export const DateTimeInsideField: Story = {
  render: () => (
    <Field label="Appointment" error="Pick a slot">
      <DateTimePicker defaultValue="2026-09-07T09:30" />
    </Field>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const date = canvas.getByRole("textbox", { name: "Appointment" });
    await expect(date).toHaveValue("07/09/2026");
    await expect(date).toHaveAttribute("aria-invalid", "true");
    await expect(date).toHaveAccessibleDescription("Pick a slot");
    const time = await canvas.findByRole("textbox", { name: "Appointment, Hora" });
    await expect(time).toHaveValue("09:30");
    await expect(time).toHaveAttribute("aria-invalid", "true");
  },
};
