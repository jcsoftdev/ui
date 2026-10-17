import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Pencil, Plus } from "../../icons/index.js";
import { Feed, FeedEvent } from "./feed.js";

const meta = {
  title: "Containers/Feed",
  component: Feed,
  tags: ["autodocs"],
  args: {
    "aria-label": "Activity",
    children: (
      <>
        <FeedEvent icon={<Plus />} time="2026-03-04T15:30:00Z" timeZone="UTC" meta="Ana">
          <b>Enrolment</b> created
        </FeedEvent>
        <FeedEvent icon={<Pencil />} time="2026-03-03" meta="Luis">
          <b>Grades</b> updated
        </FeedEvent>
        <FeedEvent time="2026-03-02T09:00:00Z" timeLabel="Mar 2, morning">
          Attendance closed
        </FeedEvent>
      </>
    ),
  },
  argTypes: { children: { control: false } },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Feed>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole("listitem")).toHaveLength(3);
    const times = Array.from(canvasElement.querySelectorAll("time"));
    await expect(times.map((t) => t.getAttribute("datetime"))).toEqual([
      "2026-03-04T15:30:00Z",
      "2026-03-03",
      "2026-03-02T09:00:00Z",
    ]);
    // A calendar date never shifts a day, whatever the viewer's zone.
    await expect(times[1]).toHaveTextContent("Mar 3, 2026");
    await expect(times[0]).toHaveTextContent("Mar 4, 2026");
    await expect(times[2]).toHaveTextContent("Mar 2, morning");
    await expect(getComputedStyle(canvas.getByRole("list")).paddingInlineStart).toBe("0px");
  },
};

export const RelativeTimes: Story = {
  render: () => (
    <Feed aria-label="Activity">
      <FeedEvent time="2026-03-04T15:25:00Z" now="2026-03-04T15:30:00Z" relative>
        Five minutes ago
      </FeedEvent>
      <FeedEvent time="2026-03-04T12:30:00Z" now="2026-03-04T15:30:00Z" relative>
        Three hours ago
      </FeedEvent>
    </Feed>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("5 minutes ago")).toBeInTheDocument();
    await expect(canvas.getByText("3 hours ago")).toBeInTheDocument();
  },
};
