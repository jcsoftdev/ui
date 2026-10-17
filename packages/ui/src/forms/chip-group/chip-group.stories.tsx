import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { Field } from "../field/field.js";
import { ChipGroup } from "./chip-group.js";

const options = [
  { value: "math", label: "Math", count: 12 },
  { value: "art", label: "Art" },
  { value: "music", label: "Music" },
  { value: "pe", label: "PE", disabled: true },
];

const meta = {
  title: "Forms/ChipGroup",
  component: ChipGroup,
  tags: ["autodocs"],
  args: { options, "aria-label": "Subjects" },
  argTypes: { options: { control: "object" } },
} satisfies Meta<typeof ChipGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Multiple: Story = {
  args: { onValueChange: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const group = canvas.getByRole("group", { name: "Subjects" });
    const math = canvas.getByRole("button", { name: /Math/ });
    const art = canvas.getByRole("button", { name: "Art" });
    await userEvent.click(math);
    await userEvent.click(art);
    await expect(math).toHaveAttribute("aria-pressed", "true");
    await expect(art).toHaveAttribute("aria-pressed", "true");
    await expect(args.onValueChange).toHaveBeenLastCalledWith(["math", "art"]);
    await userEvent.click(math);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(["art"]);
    await expect(group.querySelectorAll('[aria-pressed="true"]')).toHaveLength(1);
  },
};

export const KeyboardRovesAndToggles: Story = {
  args: { defaultValue: ["art"] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    // The tab stop is the first selected chip.
    await expect(canvas.getByRole("button", { name: "Art" })).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(canvas.getByRole("button", { name: "Music" })).toHaveFocus();
    await userEvent.keyboard(" ");
    await expect(canvas.getByRole("button", { name: "Music" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // Disabled chips leave the arrow order; the ends wrap.
    await userEvent.keyboard("{ArrowRight}");
    await expect(canvas.getByRole("button", { name: /Math/ })).toHaveFocus();
    await userEvent.keyboard("{End}");
    await expect(canvas.getByRole("button", { name: "Music" })).toHaveFocus();
    await userEvent.keyboard("{Home}{Enter}");
    await expect(canvas.getByRole("button", { name: /Math/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.tab();
    await expect(document.body).toHaveFocus();
  },
};

export const TabEntersAtFirstChipWhenNoneSelected: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.tab();
    await expect(within(canvasElement).getByRole("button", { name: /Math/ })).toHaveFocus();
  },
};

export const Single: Story = {
  args: { type: "single", onValueChange: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /Math/ }));
    await userEvent.click(canvas.getByRole("button", { name: "Art" }));
    await expect(canvas.getByRole("button", { name: /Math/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await expect(canvas.getByRole("button", { name: "Art" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(args.onValueChange).toHaveBeenLastCalledWith("art");
    // Pressing the chosen chip keeps the choice unless deselecting is allowed.
    await userEvent.click(canvas.getByRole("button", { name: "Art" }));
    await expect(canvas.getByRole("button", { name: "Art" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  },
};

export const SingleWithDeselect: Story = {
  args: { type: "single", allowDeselect: true, defaultValue: "art", onValueChange: fn() },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Art" }));
    await expect(args.onValueChange).toHaveBeenLastCalledWith("");
  },
};

function ControlledDemo() {
  const [value, setValue] = useState<string[]>(["music"]);
  return (
    <>
      <ChipGroup options={options} aria-label="Subjects" value={value} onValueChange={setValue} />
      <p data-testid="state">{value.join(",") || "none"}</p>
    </>
  );
}

export const Controlled: Story = {
  render: () => <ControlledDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Art" }));
    await waitFor(() => expect(canvas.getByTestId("state")).toHaveTextContent("music,art"));
  },
};

export const InsideField: Story = {
  render: () => (
    <Field label="Subjects" hint="Pick the ones that apply." error="Choose at least one.">
      <ChipGroup options={options} />
    </Field>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = await canvas.findByRole("group", { name: "Subjects" });
    await waitFor(() => expect(group.getAttribute("aria-describedby")).toBeTruthy());
    await expect(group).toHaveAccessibleDescription(/Pick the ones that apply\./);
    await expect(group).toHaveAccessibleDescription(/Choose at least one\./);
    await expect(group).toHaveAttribute("data-invalid");
    await expect(group).not.toHaveAttribute("aria-invalid");
  },
};

export const SubmitsHiddenInputs: Story = {
  render: () => (
    <form data-testid="form">
      <ChipGroup
        options={options}
        aria-label="Subjects"
        name="subjects"
        defaultValue={["math", "music"]}
      />
    </form>
  ),
  play: async ({ canvasElement }) => {
    const form = within(canvasElement).getByTestId("form") as HTMLFormElement;
    await expect(new FormData(form).getAll("subjects")).toEqual(["math", "music"]);
    await userEvent.click(within(form).getByRole("button", { name: "Art" }));
    await expect(new FormData(form).getAll("subjects")).toEqual(["math", "music", "art"]);
  },
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: ["math"] },
  play: async ({ canvasElement }) => {
    const buttons = within(canvasElement).getAllByRole("button");
    for (const button of buttons) await expect(button).toBeDisabled();
  },
};
