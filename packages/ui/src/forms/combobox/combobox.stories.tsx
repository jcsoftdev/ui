import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useRef, useState } from "react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import { UiStringsProvider } from "../../i18n/index.js";
import { Field } from "../field/field.js";
import { Combobox, type ComboboxOption } from "./combobox.js";

const schools: ComboboxOption[] = [
  { value: "s1", label: "Colegio San Martín", description: "Lima", keywords: "primaria" },
  { value: "s2", label: "Colegio Santa Rosa", description: "Cusco" },
  { value: "s3", label: "Instituto Ñandú", description: "Arequipa", disabled: true },
  { value: "s4", label: "Academia Pitágoras" },
];

const meta = {
  title: "Forms/Combobox",
  component: Combobox,
  tags: ["autodocs"],
  args: { "aria-label": "School", options: schools, placeholder: "Search a school" },
  argTypes: {
    options: { control: false },
    disabled: { control: "boolean" },
    invalid: { control: "boolean" },
    clearable: { control: "boolean" },
    loading: { control: "boolean" },
    size: { control: "inline-radio", options: ["sm", "md"] },
    onValueChange: { control: false },
    onSearchChange: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Combobox>;

export default meta;
type Story = StoryObj<typeof meta>;

const input = (canvas: ReturnType<typeof within>) =>
  canvas.getByRole("combobox", { name: "School" });
const list = () => screen.findByRole("listbox");

export const Default: Story = {
  args: { onValueChange: fn(), onSearchChange: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(input(canvas));
    const box = await list();
    await expect(input(canvas)).toHaveFocus();
    await expect(input(canvas)).toHaveAttribute("aria-expanded", "true");
    await expect(input(canvas)).toHaveAttribute("aria-autocomplete", "list");
    await expect(within(box).getAllByRole("option")).toHaveLength(4);
    await userEvent.keyboard("san");
    await waitFor(() => expect(within(box).getAllByRole("option")).toHaveLength(2));
    await expect(args.onSearchChange).toHaveBeenLastCalledWith("san");
    // Accent- and case-insensitive.
    await userEvent.clear(input(canvas));
    await userEvent.keyboard("PITAGORAS");
    await waitFor(() => expect(within(box).getAllByRole("option")).toHaveLength(1));
    await userEvent.click(within(box).getByRole("option"));
    await expect(args.onValueChange).toHaveBeenCalledWith("s4", schools[3]);
    await expect(input(canvas)).toHaveValue("Academia Pitágoras");
    await expect(input(canvas)).toHaveFocus();
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  },
};

export const Keyboard: Story = {
  args: { onValueChange: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    input(canvas).focus();
    const box = await list();
    const options = within(box).getAllByRole("option");
    await expect(input(canvas)).toHaveAttribute("aria-activedescendant", options[0]?.id ?? "");
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    // The disabled option is skipped.
    await expect(input(canvas)).toHaveAttribute("aria-activedescendant", options[3]?.id ?? "");
    await userEvent.keyboard("{ArrowUp}");
    await expect(input(canvas)).toHaveAttribute("aria-activedescendant", options[1]?.id ?? "");
    await userEvent.keyboard("{Enter}");
    await expect(args.onValueChange).toHaveBeenCalledWith("s2", schools[1]);
    await expect(input(canvas)).toHaveValue("Colegio Santa Rosa");
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  },
};

export const EscapeKeepsTheSelection: Story = {
  args: { defaultValue: "s1" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(input(canvas)).toHaveValue("Colegio San Martín");
    input(canvas).focus();
    await list();
    await userEvent.keyboard("zzz");
    await expect(input(canvas)).toHaveValue("zzz");
    await expect(await screen.findByText("No results")).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("listbox", { hidden: true })).toBeNull());
    await userEvent.tab();
    await expect(input(canvas)).toHaveValue("Colegio San Martín");
  },
};

export const Clearable: Story = {
  args: { defaultValue: "s1", onValueChange: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Clear" }));
    await expect(args.onValueChange).toHaveBeenCalledWith("", null);
    await expect(input(canvas)).toHaveValue("");
    await expect(canvas.queryByRole("button", { name: "Clear" })).toBeNull();
    await expect(input(canvas)).toHaveFocus();
  },
};

export const NotClearable: Story = {
  args: { defaultValue: "s1", clearable: false },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("button", { name: "Clear" })).toBeNull();
  },
};

export const BackspaceClearsAnEmptiedField: Story = {
  args: { defaultValue: "s1", onValueChange: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    input(canvas).focus();
    await userEvent.keyboard("{Backspace}");
    await expect(input(canvas)).toHaveValue("");
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.keyboard("{Backspace}");
    await expect(args.onValueChange).toHaveBeenCalledWith("", null);
  },
};

export const SubmitsTheValueNotTheText: Story = {
  args: { name: "school", defaultValue: "s2" },
  render: (args) => (
    <form data-testid="form">
      <Combobox {...args} />
    </form>
  ),
  play: async ({ canvasElement }) => {
    const form = within(canvasElement).getByTestId("form") as HTMLFormElement;
    await expect(new FormData(form).get("school")).toBe("s2");
  },
};

export const InsideField: Story = {
  render: (args) => (
    <Field label="School" hint="Where the student enrols" error="Required">
      <Combobox {...args} aria-label={undefined} />
    </Field>
  ),
  play: async ({ canvasElement }) => {
    const control = within(canvasElement).getByRole("combobox", { name: "School" });
    await expect(control).toHaveAccessibleDescription(/Where the student enrols.*Required/);
    await expect(control).toHaveAttribute("aria-invalid", "true");
  },
};

export const GroupsAndCustomEmptyText: Story = {
  args: {
    options: [
      { label: "Lima", options: schools.slice(0, 1) },
      { label: "Cusco", options: schools.slice(1, 2) },
    ],
    emptyText: "Nothing here",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(input(canvas));
    const box = await list();
    await expect(within(box).getAllByRole("group")).toHaveLength(2);
    await userEvent.keyboard("cusco");
    await waitFor(() => expect(within(box).getAllByRole("group")).toHaveLength(1));
    await userEvent.keyboard("x");
    await expect(await screen.findByText("Nothing here")).toBeVisible();
  },
};

const directory = ["Ana Torres", "Andrés Núñez", "Beatriz Ramos", "Bruno Díaz", "Camila Rojas"].map(
  (label, index) => ({ value: `p${index}`, label }),
);

function AsyncPicker({ onValueChange }: { onValueChange?: (v: string) => void }) {
  const [options, setOptions] = useState<ComboboxOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [value, setValue] = useState("");
  const [valueLabel, setValueLabel] = useState<string | undefined>();
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <Combobox
      aria-label="Person"
      placeholder="Search people"
      options={options}
      filter={false}
      loading={loading}
      value={value}
      valueLabel={valueLabel}
      onSearchChange={(query) => {
        window.clearTimeout(timer.current);
        if (!query) return;
        setLoading(true);
        timer.current = window.setTimeout(() => {
          setOptions(directory.filter((p) => p.label.toLowerCase().includes(query.toLowerCase())));
          setLoading(false);
        }, 150);
      }}
      onValueChange={(next, option) => {
        setValue(next);
        setValueLabel(option?.label);
        onValueChange?.(next);
      }}
    />
  );
}

export const AsyncOptions: Story = {
  render: () => <AsyncPicker />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const control = canvas.getByRole("combobox", { name: "Person" });
    await userEvent.click(control);
    await userEvent.keyboard("b");
    await expect(await screen.findByText("Loading")).toBeVisible();
    const box = await screen.findByRole("listbox");
    await waitFor(() => expect(within(box).getAllByRole("option")).toHaveLength(2));
    await waitFor(() => expect(screen.queryByText("Loading")).toBeNull());
    await userEvent.click(within(box).getByRole("option", { name: "Bruno Díaz" }));
    await expect(control).toHaveValue("Bruno Díaz");
    // The chosen option is no longer in `options` once the search resets, yet its label stays.
    await expect(control).toHaveValue("Bruno Díaz");
  },
};

export const Spanish: Story = {
  decorators: [
    (Story) => (
      <UiStringsProvider locale="es">
        <Story />
      </UiStringsProvider>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(input(canvas));
    await userEvent.keyboard("zzz");
    await expect(await screen.findByText("Sin resultados")).toBeVisible();
  },
};

export const Controlled: Story = {
  render: (args) => {
    const [value, setValue] = useState("s4");
    return (
      <div className="flex flex-col gap-2">
        <Combobox {...args} value={value} onValueChange={setValue} />
        <p className="text-ink-3 text-meta">Chosen: {value || "none"}</p>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Clear" }));
    await expect(canvas.getByText("Chosen: none")).toBeVisible();
  },
};

export const RequiredLeavesValidationToTheApp: Story = {
  render: (args) => (
    <form data-testid="form" noValidate={false}>
      <Combobox {...args} required />
    </form>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("combobox", { name: "School" });
    await expect(input).toHaveAttribute("aria-required", "true");
    await expect(input.hasAttribute("required")).toBe(false);
    // The browser does not block submit, so the app can render its own error first.
    await expect((canvas.getByTestId("form") as HTMLFormElement).checkValidity()).toBe(true);
  },
};

export const NativeRequired: Story = {
  render: (args) => (
    <form data-testid="form">
      <Combobox {...args} required nativeRequired />
    </form>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("combobox", { name: "School" });
    await expect(input).toHaveAttribute("aria-required", "true");
    await expect(input).toBeRequired();
    await expect((canvas.getByTestId("form") as HTMLFormElement).checkValidity()).toBe(false);
  },
};
