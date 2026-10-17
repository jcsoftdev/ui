import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { Input } from "../../forms/input/input.js";
import { UiStringsProvider } from "../../i18n/index.js";
import { Wizard, type WizardStep } from "./wizard.js";

const steps: WizardStep[] = [
  { id: "service", label: "Service", content: <p>Pick a service.</p> },
  { id: "time", label: "Time", content: <Input aria-label="Time slot" /> },
  { id: "confirm", label: "Confirm", content: <p>Review and confirm.</p> },
];

const meta = {
  title: "Navigation/Wizard",
  component: Wizard,
  tags: ["autodocs"],
  args: { steps },
  argTypes: {
    steps: { control: "object" },
    value: { control: false },
    onValueChange: { control: false },
    onBeforeNext: { control: false },
    onComplete: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="max-w-xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Wizard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Back" })).toBeDisabled();
    await expect(canvas.getByText("Service", { selector: "span" })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Next" }));
    const heading = await canvas.findByRole("heading", { name: "Step 2 of 3: Time" });
    await expect(heading).toHaveFocus();
    await expect(canvasElement.querySelector('[aria-current="step"]')).toHaveTextContent("Time");
    await userEvent.click(canvas.getByRole("button", { name: "Next" }));
    await userEvent.click(await canvas.findByRole("button", { name: "Finish" }));
    await userEvent.click(canvas.getByRole("button", { name: "Back" }));
    await canvas.findByRole("heading", { name: "Step 2 of 3: Time" });
  },
};

export const FinishCallsOnComplete: Story = {
  args: { defaultValue: "confirm", onComplete: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Finish" }));
    await waitFor(() => expect(args.onComplete).toHaveBeenCalledTimes(1));
  },
};

export const BlockedByValidation: Story = {
  args: { onBeforeNext: fn(() => false), onValueChange: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(args.onBeforeNext).toHaveBeenCalledTimes(1));
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(canvas.queryByRole("alert")).toBeNull();
    await expect(canvas.getByRole("button", { name: "Next" })).toBeEnabled();
  },
};

export const ThrowingValidationShowsAnError: Story = {
  args: {
    onBeforeNext: () => {
      throw new Error("boom");
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Next" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent("could not be completed");
    await expect(canvas.queryByRole("heading", { name: /Step 2/ })).toBeNull();
  },
};

export const AsyncValidationIsPendingAndRunsOnce: Story = {
  args: {
    onBeforeNext: fn(() => new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 150))),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const next = canvas.getByRole("button", { name: "Next" });
    await userEvent.dblClick(next);
    await waitFor(() => expect(canvasElement.querySelector("[data-pending]")).not.toBeNull());
    await expect(canvas.getByRole("button", { name: "Back" })).toBeDisabled();
    await canvas.findByRole("heading", { name: "Step 2 of 3: Time" });
    await expect(args.onBeforeNext).toHaveBeenCalledTimes(1);
    await expect(canvasElement.querySelector("[data-pending]")).toBeNull();
  },
};

export const StepCanAdvanceFalseDisablesNext: Story = {
  args: {
    steps: [
      { id: "terms", label: "Terms", content: <p>Accept the terms.</p>, canAdvance: false },
      { id: "done", label: "Done", content: <p>Done.</p> },
    ],
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("button", { name: "Next" })).toBeDisabled();
  },
};

export const StepCanAdvanceFunction: Story = {
  args: {
    steps: [
      { id: "a", label: "A", content: <p>A</p>, canAdvance: async () => false },
      { id: "b", label: "B", content: <p>B</p> },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(canvas.getByRole("button", { name: "Next" })).toBeEnabled());
    await expect(canvas.queryByRole("heading", { name: /Step 2/ })).toBeNull();
  },
};

export const EnterInAnInputAdvances: Story = {
  args: { defaultValue: "time" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("textbox", { name: "Time slot" }));
    await userEvent.keyboard("{Enter}");
    await canvas.findByRole("heading", { name: "Step 3 of 3: Confirm" });
  },
};

export const Controlled: Story = {
  render: (args) => {
    const [id, setId] = useState("time");
    return (
      <>
        <p data-testid="current">{id}</p>
        <Wizard {...args} value={id} onValueChange={setId} />
      </>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Back" }));
    await waitFor(() => expect(canvas.getByTestId("current")).toHaveTextContent("service"));
  },
};

export const Spanish: Story = {
  render: (args) => (
    <UiStringsProvider locale="es">
      <Wizard {...args} />
    </UiStringsProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Atrás" })).toBeDisabled();
    await userEvent.click(canvas.getByRole("button", { name: "Siguiente" }));
    await canvas.findByRole("heading", { name: "Paso 2 de 3: Time" });
  },
};

export const CompactInNarrowContainer: Story = {
  decorators: [
    (Story) => (
      <div className="w-72 max-w-full">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const heading = within(canvasElement).getByRole("heading", { name: "Step 1 of 3: Service" });
    await expect(heading.getBoundingClientRect().width).toBeGreaterThan(1);
    const footer = within(canvasElement).getByRole("button", { name: "Next" }).parentElement;
    await expect(footer && getComputedStyle(footer).flexDirection).toBe("column-reverse");
  },
};
