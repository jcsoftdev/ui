import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Chip } from "../../atoms/chip/chip.js";
import { CalendarCheck, Package, Star, Wallet, XCircle } from "../../icons/index.js";
import { Timeline, type TimelineFeedItem } from "./timeline.js";

const items: TimelineFeedItem[] = [
  {
    id: "1",
    group: "Hoy",
    title: "Cita confirmada",
    time: "14:30",
    actor: "Luis Ramírez",
    description: "Corte clásico con Diego Quispe a las 16:00.",
    icon: <CalendarCheck />,
    tone: "success",
  },
  {
    id: "2",
    group: "Hoy",
    title: "Pago recibido por Yape",
    time: "13:05",
    actor: "Marco Salazar",
    icon: <Wallet />,
    tone: "accent",
    children: <Chip tone="success">S/ 35</Chip>,
  },
  {
    id: "3",
    group: "Hoy",
    title: "Cita cancelada",
    time: "10:12",
    actor: "Andrés Paredes",
    description: "Avisó con 3 horas de anticipación.",
    icon: <XCircle />,
    tone: "danger",
  },
  {
    id: "4",
    group: "Ayer",
    title: "Stock bajo: pomada mate",
    time: "18:40",
    description: "Quedan 2 unidades. Punto de reposición: 5.",
    icon: <Package />,
    tone: "warning",
  },
  {
    id: "5",
    group: "Ayer",
    title: "Nueva reseña de 5 estrellas",
    time: "11:20",
    actor: "Jorge Castillo",
    icon: <Star />,
    tone: "accent",
  },
];

const meta = {
  title: "Containers/Timeline",
  component: Timeline,
  tags: ["autodocs"],
  args: { items },
  argTypes: { items: { control: false } },
  decorators: [
    (Story) => (
      <div className="w-full max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Timeline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Ungrouped: Story = {
  args: { items: items.map(({ group: _group, ...item }) => item) },
};

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="w-[320px] max-w-full">
        <Story />
      </div>
    ),
  ],
};

export const BrutalPreset: Story = {
  decorators: [
    (Story) => (
      <div data-style="brutal" className="bg-bg p-card">
        <Story />
      </div>
    ),
  ],
};

export const Statuses: Story = {
  args: {
    "aria-label": "Admission process",
    items: [
      { id: "a", title: "Application received", time: "Mar 1", status: "done" },
      { id: "b", title: "Documents reviewed", time: "Mar 3", status: "done" },
      { id: "c", title: "Interview", description: "Scheduled for Mar 12.", status: "current" },
      { id: "d", title: "Payment failed", status: "error" },
      { id: "e", title: "Decision", status: "pending" },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvasElement.querySelectorAll("[aria-current='step']")).toHaveLength(1);
    await expect(canvas.getAllByText(", Completed")).toHaveLength(2);
    await expect(canvas.getByText(", Has an error")).toBeInTheDocument();
  },
};

export const Composed: Story = {
  render: () => (
    <Timeline aria-label="Admission process">
      <Timeline.Item title="Applied" time="Mar 1" status="done" group="March" />
      <Timeline.Item title="Interview" status="current" group="March">
        <Chip tone="info">12:30</Chip>
      </Timeline.Item>
      <Timeline.Item title="Decision" status="pending" group="April" />
    </Timeline>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { level: 4, name: "March" })).toBeInTheDocument();
    await expect(canvas.getByRole("heading", { level: 4, name: "April" })).toBeInTheDocument();
    await expect(canvas.getByText("12:30")).toBeVisible();
  },
};
