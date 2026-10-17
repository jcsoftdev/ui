import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import { UiStringsProvider } from "../../i18n/index.js";
import { Field } from "../field/field.js";
import { SelectMenu, type SelectMenuProps } from "./select-menu.js";

const barbers = [
  { value: "diego", label: "Diego Quispe", description: "Fades and beards" },
  { value: "luis", label: "Luis Paredes" },
  { value: "andrea", label: "Andrea Ríos", disabled: true },
  { value: "mateo", label: "Mateo Salas" },
];

const meta = {
  title: "Forms/SelectMenu",
  component: SelectMenu,
  tags: ["autodocs"],
  args: { "aria-label": "Barber", options: barbers, placeholder: "Pick a barber" },
  argTypes: {
    options: { control: false },
    disabled: { control: "boolean" },
    invalid: { control: "boolean" },
    size: { control: "inline-radio", options: ["sm", "md"] },
    onValueChange: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SelectMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

const trigger = (canvas: ReturnType<typeof within>) =>
  canvas.getByRole("combobox", { name: "Barber" });
const list = () => screen.findByRole("listbox");

export const Default: Story = {
  args: { onValueChange: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(trigger(canvas)).toHaveTextContent("Pick a barber");
    await expect(trigger(canvas)).toHaveAttribute("aria-haspopup", "listbox");
    await expect(trigger(canvas)).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(trigger(canvas));
    const box = await list();
    await expect(trigger(canvas)).toHaveAttribute("aria-expanded", "true");
    await expect(trigger(canvas)).toHaveFocus();
    await expect(within(box).getAllByRole("option")).toHaveLength(4);
    await expect(within(box).getByRole("option", { name: /Andrea/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await userEvent.click(within(box).getByRole("option", { name: /Luis/ }));
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    await expect(trigger(canvas)).toHaveTextContent("Luis Paredes");
    await expect(args.onValueChange).toHaveBeenCalledWith("luis");
    await expect(trigger(canvas)).toHaveFocus();
  },
};

export const Keyboard: Story = {
  args: { onValueChange: fn(), defaultValue: "luis" },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    trigger(canvas).focus();
    await userEvent.keyboard("{ArrowDown}");
    const box = await list();
    const options = within(box).getAllByRole("option");
    // Opens on the selected option.
    await expect(trigger(canvas)).toHaveAttribute("aria-activedescendant", options[1]?.id ?? "");
    await userEvent.keyboard("{ArrowDown}");
    // The disabled option is skipped.
    await expect(trigger(canvas)).toHaveAttribute("aria-activedescendant", options[3]?.id ?? "");
    await userEvent.keyboard("{ArrowDown}");
    await expect(trigger(canvas)).toHaveAttribute("aria-activedescendant", options[3]?.id ?? "");
    await userEvent.keyboard("{Home}");
    await expect(trigger(canvas)).toHaveAttribute("aria-activedescendant", options[0]?.id ?? "");
    await userEvent.keyboard("{End}");
    await expect(trigger(canvas)).toHaveAttribute("aria-activedescendant", options[3]?.id ?? "");
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    await expect(args.onValueChange).toHaveBeenLastCalledWith("mateo");
    await expect(trigger(canvas)).toHaveFocus();
  },
};

export const EscapeCloses: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    trigger(canvas).focus();
    await userEvent.keyboard("{Enter}");
    await list();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    await expect(trigger(canvas)).toHaveFocus();
    await expect(trigger(canvas)).toHaveTextContent("Pick a barber");
  },
};

export const SpaceOpensAndTabCloses: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    trigger(canvas).focus();
    await userEvent.keyboard(" ");
    await list();
    await userEvent.keyboard("{Tab}");
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  },
};

export const Typeahead: Story = {
  args: { onValueChange: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    trigger(canvas).focus();
    // Closed: typing selects the match.
    await userEvent.keyboard("m");
    await expect(trigger(canvas)).toHaveTextContent("Mateo Salas");
    await expect(args.onValueChange).toHaveBeenCalledWith("mateo");
    await userEvent.keyboard("{ArrowDown}");
    const box = await list();
    const options = within(box).getAllByRole("option");
    await new Promise((resolve) => setTimeout(resolve, 700));
    await userEvent.keyboard("l");
    await expect(trigger(canvas)).toHaveAttribute("aria-activedescendant", options[1]?.id ?? "");
    // A disabled match is never reached.
    await new Promise((resolve) => setTimeout(resolve, 700));
    await userEvent.keyboard("a");
    await expect(trigger(canvas)).toHaveAttribute("aria-activedescendant", options[1]?.id ?? "");
  },
};

export const Groups: Story = {
  args: {
    options: [
      { label: "Barbers", options: barbers.slice(0, 2) },
      { label: "Assistants", options: [{ value: "carla", label: "Carla Vega" }] },
    ],
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(trigger(within(canvasElement)));
    const box = await list();
    const groups = within(box).getAllByRole("group");
    await expect(groups).toHaveLength(2);
    await expect(groups[1]).toHaveAccessibleName("Assistants");
    await expect(within(groups[1] as HTMLElement).getByRole("option")).toHaveTextContent(
      "Carla Vega",
    );
  },
};

export const EmptyStringIsAnOption: Story = {
  args: {
    options: [{ value: "", label: "All barbers" }, ...barbers],
    value: "",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(trigger(canvas)).toHaveTextContent("All barbers");
    await userEvent.click(trigger(canvas));
    const box = await list();
    await expect(within(box).getByRole("option", { name: "All barbers" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  },
};

export const InsideField: Story = {
  render: (args) => (
    <Field label="Barber" hint="Who cuts the hair" error="Pick one">
      <SelectMenu {...args} aria-label={undefined} />
    </Field>
  ),
  play: async ({ canvasElement }) => {
    const control = within(canvasElement).getByRole("combobox", { name: "Barber" });
    await expect(control).toHaveAccessibleDescription(/Who cuts the hair.*Pick one/);
    await expect(control).toHaveAttribute("aria-invalid", "true");
    await userEvent.click(control);
    await expect(await screen.findByRole("listbox")).toHaveAccessibleName("Barber");
  },
};

export const SubmitsWithAForm: Story = {
  render: (args) => (
    <form data-testid="form">
      <SelectMenu {...args} name="barber" />
    </form>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(trigger(canvas));
    await userEvent.click(within(await list()).getByRole("option", { name: /Diego/ }));
    const form = canvas.getByTestId("form") as HTMLFormElement;
    await expect(new FormData(form).get("barber")).toBe("diego");
  },
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: "diego" },
  play: async ({ canvasElement }) => {
    const control = trigger(within(canvasElement));
    await expect(control).toBeDisabled();
    await userEvent.click(control);
    await expect(screen.queryByRole("listbox")).toBeNull();
  },
};

export const Controlled: Story = {
  render: (args) => {
    const [value, setValue] = useState("luis");
    return (
      <div className="flex flex-col gap-2">
        <SelectMenu {...args} value={value} onValueChange={setValue} />
        <p className="text-ink-3 text-meta">Chosen: {value}</p>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(trigger(canvas));
    await userEvent.click(within(await list()).getByRole("option", { name: /Mateo/ }));
    await expect(canvas.getByText("Chosen: mateo")).toBeVisible();
  },
};

export const SpanishPlaceholder: Story = {
  args: { placeholder: undefined } as Partial<SelectMenuProps>,
  decorators: [
    (Story) => (
      <UiStringsProvider locale="es">
        <Story />
      </UiStringsProvider>
    ),
  ],
  play: async ({ canvasElement }) => {
    await expect(trigger(within(canvasElement))).toHaveTextContent("Seleccionar…");
  },
};
