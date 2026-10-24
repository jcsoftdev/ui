import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { Button } from "../../atoms/button/button.js";
import { ChipGroup } from "../../forms/chip-group/chip-group.js";
import { Input } from "../../forms/input/input.js";
import { UiStringsProvider } from "../../i18n/index.js";
import {
  ListDetail,
  ListDetailDetail,
  ListDetailDetailHeader,
  ListDetailEmpty,
  ListDetailHeader,
  ListDetailItem,
  ListDetailList,
  ListDetailMeta,
  ListDetailTitle,
  useListDetail,
} from "./list-detail.js";

const students = [
  { id: "ana", name: "Ana Torres", grade: "3rd A" },
  { id: "luis", name: "Luis Ramírez", grade: "3rd B" },
  { id: "marta", name: "Marta Vega", grade: "4th A" },
];

function Detail() {
  const { value } = useListDetail();
  const student = students.find((s) => s.id === value);
  return (
    <ListDetailDetail>
      {student ? (
        <>
          <ListDetailDetailHeader
            title={student.name}
            description={student.grade}
            actions={<Button size="sm">Edit</Button>}
          />
          <p className="m-0 text-body text-ink-2">Record of {student.name}.</p>
        </>
      ) : (
        <>
          <p className="m-0 py-4 text-body text-ink-3">Pick a student.</p>
          <ListDetailEmpty title="No student selected" description="Choose one from the list." />
        </>
      )}
    </ListDetailDetail>
  );
}

function Example(props: Partial<React.ComponentProps<typeof ListDetail>>) {
  return (
    <ListDetail aria-label="Students" {...props}>
      <ListDetailList>
        {students.map((s) => (
          <ListDetailItem key={s.id} value={s.id} trailing={s.grade}>
            <ListDetailTitle>{s.name}</ListDetailTitle>
            <ListDetailMeta>Enrolled</ListDetailMeta>
          </ListDetailItem>
        ))}
      </ListDetailList>
      <Detail />
    </ListDetail>
  );
}

const meta = {
  title: "Containers/ListDetail",
  component: ListDetail,
  tags: ["autodocs"],
  args: { "aria-label": "Students", children: null },
  argTypes: { children: { control: false } },
  render: (args) => <Example {...args} />,
} satisfies Meta<typeof ListDetail>;

export default meta;
type Story = StoryObj<typeof meta>;

const inWidth = (width: string) => [
  (Story: () => React.ReactElement) => (
    <div style={{ width }}>
      <Story />
    </div>
  ),
];

export const SideBySide: Story = {
  decorators: inWidth("48rem"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const list = canvas.getByRole("list", { name: "Students" });
    await expect(list).toBeVisible();
    await expect(canvas.getByText("Pick a student.")).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Back to list" })).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: /Luis/ }));
    await expect(canvas.getByRole("button", { name: /Luis/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await expect(canvas.getByRole("region", { name: "Luis Ramírez" })).toBeVisible();
    // Beside the list, the list stays visible and keeps focus.
    await expect(list).toBeVisible();
    await expect(canvas.getByRole("button", { name: /Luis/ })).toHaveFocus();
    await expect(
      getComputedStyle(list.closest("[data-view]") as Element).gridTemplateColumns.split(" "),
    ).toHaveLength(2);
  },
};

export const CollapsesToSinglePane: Story = {
  decorators: inWidth("22rem"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const list = canvas.getByRole("list", { name: "Students" });
    await expect(list).toBeVisible();
    await expect(canvasElement.querySelector('[data-list-detail-pane="detail"]')).not.toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: /Marta/ }));
    const detail = await canvas.findByRole("region", { name: "Marta Vega" });
    await expect(detail).toBeVisible();
    await expect(list).not.toBeVisible();
    await waitFor(() => expect(detail).toHaveFocus());
    await userEvent.click(canvas.getByRole("button", { name: "Back to list" }));
    await expect(list).toBeVisible();
    await waitFor(() => expect(canvas.getByRole("button", { name: /Marta/ })).toHaveFocus());
    await expect(canvasElement.querySelector('[data-list-detail-pane="detail"]')).not.toBeVisible();
  },
};

export const Controlled: Story = {
  decorators: inWidth("22rem"),
  render: () => {
    const [value, setValue] = useState<string | null>("ana");
    return (
      <>
        <p data-testid="value">{String(value)}</p>
        <Example value={value} onValueChange={setValue} onBack={() => setValue(null)} />
      </>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("region", { name: "Ana Torres" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Back to list" }));
    await waitFor(() => expect(canvas.getByTestId("value")).toHaveTextContent("null"));
    await expect(canvas.getByRole("list", { name: "Students" })).toBeVisible();
  },
};

export const ReportsSelection: Story = {
  decorators: inWidth("48rem"),
  args: { onValueChange: fn() },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: /Ana/ }));
    await expect(args.onValueChange).toHaveBeenCalledWith("ana");
  },
};

export const SpanishBack: Story = {
  decorators: inWidth("22rem"),
  render: () => (
    <UiStringsProvider locale="es">
      <Example defaultValue="ana" />
    </UiStringsProvider>
  ),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", { name: "Volver a la lista" }),
    ).toBeVisible();
  },
};

/** Back calls `onBack` and never reports `null` to `onValueChange`; uncontrolled it still shows the list. */
export const BackCallsOnBack: Story = {
  decorators: inWidth("22rem"),
  args: { onValueChange: fn(), onBack: fn() },
  render: (args) => (
    <Example defaultValue="ana" onValueChange={args.onValueChange} onBack={args.onBack} />
  ),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Back to list" }));
    await expect(canvas.getByRole("list", { name: "Students" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: /Luis/ }));
    await userEvent.click(canvas.getByRole("button", { name: "Back to list" }));
    await expect(args.onBack).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith("luis");
  },
};

const columns = (element: Element) =>
  getComputedStyle(element.closest("[data-view]") as Element).gridTemplateColumns.split(" ");

/** `listWidth` gives the list a fixed rail; the detail takes the rest. */
export const ListRail: Story = {
  decorators: inWidth("60rem"),
  args: { listWidth: 320 },
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByRole("list", { name: "Students" });
    const [first, second] = columns(list);
    await expect(first).toBe("320px");
    await expect(Number.parseFloat(second ?? "0")).toBeGreaterThan(320);
  },
};

/** `ratio` splits proportionally when no fixed width is wanted. */
export const NarrowRatio: Story = {
  decorators: inWidth("60rem"),
  args: { ratio: "1:2" },
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByRole("list", { name: "Students" });
    const [first, second] = columns(list).map(Number.parseFloat);
    await expect((second ?? 0) / (first ?? 1)).toBeCloseTo(2, 0);
  },
};

/** A header above the list with a search field, filter chips and a result count; card panes. */
export const CardWithHeader: Story = {
  decorators: inWidth("60rem"),
  args: { listWidth: "20rem", surface: "card", stickyList: true },
  render: (args) => (
    <ListDetail {...args}>
      <ListDetailList
        header={
          <ListDetailHeader count={students.length}>
            <Input aria-label="Search students" placeholder="Search" className="basis-full" />
            <ChipGroup
              type="single"
              defaultValue="all"
              aria-label="Status"
              options={[
                { value: "all", label: "All" },
                { value: "active", label: "Active" },
              ]}
            />
          </ListDetailHeader>
        }
      >
        {students.map((s) => (
          <ListDetailItem key={s.id} value={s.id} trailing={s.grade}>
            <ListDetailTitle>{s.name}</ListDetailTitle>
            <ListDetailMeta>Enrolled</ListDetailMeta>
          </ListDetailItem>
        ))}
      </ListDetailList>
      <Detail />
    </ListDetail>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("textbox", { name: "Search students" })).toBeVisible();
    await expect(canvas.getByRole("list", { name: "Students" })).toBeVisible();
    await expect(canvas.getByText("No student selected")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: /Ana/ }));
    await expect(canvas.queryByText("No student selected")).toBeNull();
  },
};
