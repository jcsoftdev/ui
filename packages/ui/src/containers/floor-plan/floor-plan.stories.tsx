import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fireEvent, userEvent, within } from "storybook/test";
import { UiStringsProvider } from "../../i18n/index.js";
import { CircleCheck, Clock, Lock, TriangleAlert, Users } from "../../icons/index.js";
import {
  FloorPlan,
  type FloorPlanItem,
  type FloorPlanLandmark,
  type FloorPlanProps,
} from "./floor-plan.js";

type Status = "free" | "reserved" | "seated" | "bill" | "late" | "blocked";

const statusItem: Record<Status, Partial<FloorPlanItem>> = {
  free: { tone: "neutral", pattern: "dashed", statusLabel: "Free" },
  reserved: {
    tone: "info",
    pattern: "soft",
    statusLabel: "Reserved",
    statusIcon: <Clock className="size-3" />,
  },
  seated: {
    tone: "success",
    pattern: "strong",
    statusLabel: "Seated",
    statusIcon: <Users className="size-3" />,
  },
  bill: {
    tone: "warning",
    pattern: "solid",
    statusLabel: "Bill",
    statusIcon: <CircleCheck className="size-3" />,
  },
  late: {
    tone: "danger",
    pattern: "solid",
    ring: "late",
    statusLabel: "Late",
    statusIcon: <TriangleAlert className="size-3" />,
  },
  blocked: {
    tone: "neutral",
    pattern: "soft",
    statusLabel: "Blocked",
    statusIcon: <Lock className="size-3" />,
  },
};

const cycle: Status[] = ["free", "seated", "reserved", "free", "bill", "seated", "late", "blocked"];

function table(
  id: string,
  x: number,
  y: number,
  index: number,
  overrides: Partial<FloorPlanItem> = {},
): FloorPlanItem {
  const status = cycle[index % cycle.length] as Status;
  const seats = [2, 4, 4, 6][index % 4] as number;
  const seated = status === "seated" || status === "bill" || status === "late";
  return {
    id,
    x,
    y,
    width: 2,
    height: 2,
    shape: index % 3 === 0 ? "round" : "square",
    seats,
    occupied: seated ? Math.max(1, seats - 1) : 0,
    label: id,
    ...statusItem[status],
    ...overrides,
  };
}

function buildPlan(): { items: FloorPlanItem[]; landmarks: FloorPlanLandmark[] } {
  const items: FloorPlanItem[] = [];
  for (let i = 0; i < 20; i += 1) {
    items.push(table(`S${i + 1}`, 1 + (i % 5) * 4, 3 + Math.floor(i / 5) * 4, i));
  }
  for (let i = 0; i < 12; i += 1) {
    items.push(
      table(`T${i + 1}`, 23 + (i % 3) * 4, 3 + Math.floor(i / 3) * 4, i + 3, { shape: "round" }),
    );
  }
  for (let i = 0; i < 8; i += 1) {
    items.push(
      table(`B${i + 1}`, 1 + i * 4, 22, i + 1, {
        shape: "bar",
        width: 3,
        height: 1,
        seats: 3,
        occupied: i % 3,
      }),
    );
  }
  return {
    items,
    landmarks: [
      { id: "a1", kind: "area", label: "Salon", x: 1, y: 1, width: 19, height: 1 },
      { id: "a2", kind: "area", label: "Terrace", x: 23, y: 1, width: 11, height: 1 },
      { id: "a3", kind: "area", label: "Bar", x: 1, y: 20, width: 31, height: 1 },
      { id: "w1", kind: "wall", label: "Entrance", x: 20.5, y: 9, width: 1.5, height: 6 },
      { id: "k1", kind: "stairs", label: "Stairs", x: 33, y: 20, width: 2.5, height: 5 },
    ],
  };
}

const plan = buildPlan();
const salonGrouped = plan.items.map((item) =>
  item.id === "S7" || item.id === "S8" ? { ...item, groupId: "merge-1" } : item,
);

const meta = {
  title: "Containers/FloorPlan",
  component: FloorPlan,
  tags: ["autodocs"],
  args: { width: 36, height: 26, items: plan.items, landmarks: plan.landmarks },
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FloorPlan>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll("button[data-item]")).toHaveLength(40);
  },
};

export const MergedTables: Story = { args: { items: salonGrouped } };

function Interactive(props: FloorPlanProps) {
  const [selected, setSelected] = useState<string | null>(null);
  return <FloorPlan {...props} selectedId={selected} onSelect={setSelected} />;
}

export const Selectable: Story = {
  render: (args) => <Interactive {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole("button");
    await userEvent.click(buttons[2] as HTMLElement);
    await expect(buttons[2]).toHaveAttribute("aria-pressed", "true");
    await expect(buttons[2]).toHaveAttribute("data-ring", "selected");
    await expect(buttons[0]).toHaveAttribute("aria-pressed", "false");
  },
};

export const RovingFocus: Story = {
  render: (args) => <Interactive {...args} />,
  play: async ({ canvasElement }) => {
    const buttons = within(canvasElement).getAllByRole("button");
    await userEvent.tab();
    await expect(buttons[0]).toHaveFocus();
    await expect(buttons.filter((b) => b.tabIndex === 0)).toHaveLength(1);
    await userEvent.keyboard("{ArrowRight}");
    await expect(buttons[1]).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    await expect(buttons[2]).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}");
    await expect(buttons[1]).toHaveFocus();
    await userEvent.keyboard("{End}");
    await expect(buttons[buttons.length - 1]).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(buttons[0]).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(buttons[0]).toHaveAttribute("aria-pressed", "true");
  },
};

const everyState: FloorPlanItem[] = (Object.keys(statusItem) as Status[]).flatMap((status, i) => [
  table(`${status}`, 1 + i * 5, 1, 0, {
    ...statusItem[status],
    shape: "round",
    width: 4,
    height: 4,
    seats: 4,
    occupied: status === "free" || status === "blocked" || status === "reserved" ? 0 : 3,
  }),
  table(`${status}-s`, 1 + i * 5, 7, 0, {
    ...statusItem[status],
    shape: "square",
    seats: 2,
    occupied: status === "free" || status === "blocked" || status === "reserved" ? 0 : 1,
  }),
]);

export const EveryState: Story = {
  args: { width: 31, height: 11, items: everyState, landmarks: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const text of ["Free", "Reserved", "Seated", "Bill", "Late", "Blocked"]) {
      await expect(canvas.getAllByText(text).length).toBeGreaterThan(0);
    }
    await expect(canvasElement.querySelectorAll("[data-ring=late]")).toHaveLength(2);
  },
};

export const SelectedRing: Story = {
  args: { width: 31, height: 11, items: everyState, landmarks: [], selectedId: "seated" },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll("[data-ring=selected]")).toHaveLength(1);
  },
};

export const Dark: Story = { globals: { theme: "dark" }, args: { items: salonGrouped } };

export const DarkEveryState: Story = {
  globals: { theme: "dark" },
  args: { width: 31, height: 11, items: everyState, landmarks: [] },
};

export const Spanish: Story = {
  render: (args) => (
    <UiStringsProvider locale="es">
      <FloorPlan {...args} />
    </UiStringsProvider>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("group")).toHaveAccessibleName("Plano de sala");
  },
};

const editItems: FloorPlanItem[] = [
  table("E1", 1, 1, 1, { width: 2, height: 2, shape: "round" }),
  table("E2", 5, 1, 4, { width: 2, height: 2, shape: "square" }),
  table("E3", 9, 1, 6, { width: 4, height: 2, shape: "rect", seats: 6, occupied: 2 }),
  table("E4", 1, 6, 0, { width: 2, height: 2, shape: "square" }),
  table("E5", 5, 6, 2, { width: 2, height: 2, shape: "square", groupId: "pair" }),
  table("E6", 7, 6, 2, { width: 2, height: 2, shape: "square", groupId: "pair" }),
];

const editLandmarks: FloorPlanLandmark[] = [
  { id: "door", kind: "door", label: "Door", x: 14, y: 5, width: 1, height: 3 },
  { id: "bar", kind: "bar", label: "Bar", x: 1, y: 9, width: 8, height: 1 },
];

function Editor(props: FloorPlanProps) {
  const [items, setItems] = useState(props.items);
  const [landmarks, setLandmarks] = useState(props.landmarks ?? []);
  const [selected, setSelected] = useState<string | null>(null);
  const [changes, setChanges] = useState(0);
  return (
    <div className="flex flex-col gap-3">
      <FloorPlan
        {...props}
        items={items}
        landmarks={landmarks}
        selectedId={selected}
        onSelect={setSelected}
        onChange={(nextItems, nextLandmarks) => {
          setItems(nextItems);
          setLandmarks(nextLandmarks);
          setChanges((count) => count + 1);
        }}
      />
      <output className="text-ink-2 text-meta" data-testid="changes">
        {changes} changes
      </output>
    </div>
  );
}

const boxOf = (element: HTMLElement) => element.getBoundingClientRect();

export const Editable: Story = {
  args: { width: 16, height: 11, items: editItems, landmarks: editLandmarks, editable: true },
  render: (args) => <Editor {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const e1 = canvasElement.querySelector("[data-item=E1]") as HTMLElement;
    const before = boxOf(e1);
    const unit = boxOf(canvasElement.querySelector("[role=group]") as HTMLElement).width / 16;

    e1.focus();
    await userEvent.keyboard("{Alt>}{ArrowRight}{/Alt}");
    await expect(boxOf(e1).left - before.left).toBeCloseTo(unit, 0);
    await userEvent.keyboard("{Alt>}{Shift>}{ArrowDown}{/Shift}{/Alt}");
    await expect(boxOf(e1).height).toBeCloseTo(before.height + unit, 0);
    await expect(canvas.getByTestId("changes")).toHaveTextContent("2 changes");

    const e3 = canvasElement.querySelector("[data-item=E3]") as HTMLElement;
    e3.focus();
    const wide = boxOf(e3);
    await userEvent.keyboard("r");
    await expect(boxOf(e3).width).toBeCloseTo(wide.height, 0);
    await expect(boxOf(e3).height).toBeCloseTo(wide.width, 0);

    const e2 = canvasElement.querySelector("[data-item=E2]") as HTMLElement;
    const start = boxOf(e2);
    const cx = start.left + start.width / 2;
    const cy = start.top + start.height / 2;
    await fireEvent.pointerDown(e2, { clientX: cx, clientY: cy, button: 0, pointerId: 7 });
    await fireEvent.pointerMove(e2, {
      clientX: cx + unit * 2.2,
      clientY: cy + unit * 3.1,
      pointerId: 7,
    });
    await fireEvent.pointerUp(e2, {
      clientX: cx + unit * 2.2,
      clientY: cy + unit * 3.1,
      pointerId: 7,
    });
    const moved = boxOf(e2);
    await expect((moved.left - start.left) / unit).toBeCloseTo(2, 1);
    await expect((moved.top - start.top) / unit).toBeCloseTo(3, 1);
    await expect(e2).toHaveAttribute("aria-pressed", "true");

    const handle = canvasElement.querySelector("[data-handle=se]") as HTMLElement;
    const hb = boxOf(handle);
    await fireEvent.pointerDown(handle, {
      clientX: hb.left + 4,
      clientY: hb.top + 4,
      button: 0,
      pointerId: 8,
    });
    await fireEvent.pointerMove(handle, {
      clientX: hb.left + 4 + unit,
      clientY: hb.top + 4 + unit,
      pointerId: 8,
    });
    await fireEvent.pointerUp(handle, {
      clientX: hb.left + 4 + unit,
      clientY: hb.top + 4 + unit,
      pointerId: 8,
    });
    await expect(boxOf(e2).width / unit).toBeCloseTo(3, 1);

    await userEvent.click(canvas.getByRole("button", { name: "Rotate 90°" }));
    await expect(boxOf(e2).width / unit).toBeCloseTo(3, 1);
  },
};

export const EditableDark: Story = {
  globals: { theme: "dark" },
  args: { width: 16, height: 11, items: editItems, landmarks: editLandmarks, editable: true },
  render: (args) => <Editor {...args} />,
};
