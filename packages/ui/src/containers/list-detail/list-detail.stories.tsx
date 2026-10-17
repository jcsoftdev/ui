import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { Button } from "../../atoms/button/button.js";
import { UiStringsProvider } from "../../i18n/index.js";
import {
  ListDetail,
  ListDetailDetail,
  ListDetailDetailHeader,
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
        <p className="m-0 py-4 text-body text-ink-3">Pick a student.</p>
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
      getComputedStyle(list.parentElement as Element).gridTemplateColumns.split(" "),
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
