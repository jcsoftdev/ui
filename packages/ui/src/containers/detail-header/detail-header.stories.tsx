import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Avatar } from "../../atoms/avatar/avatar.js";
import { Button } from "../../atoms/button/button.js";
import { Chip } from "../../atoms/chip/chip.js";
import { Facts } from "../facts/facts.js";
import { DetailHeader } from "./detail-header.js";

const meta = {
  title: "Containers/DetailHeader",
  component: DetailHeader,
  tags: ["autodocs"],
  args: {
    name: "Ana Torres",
    subtitle: "Applicant 2041 · Grade 3",
    avatar: <Avatar name="Ana Torres" size="lg" className="size-14 text-fs-150" />,
    status: <Chip tone="warning">In review</Chip>,
    actions: (
      <>
        <Button variant="secondary">Request documents</Button>
        <Button>Approve</Button>
      </>
    ),
    facts: (
      <Facts>
        <div>
          <dt>Guardian</dt>
          <dd>Rosa Quispe</dd>
        </div>
        <div>
          <dt>Applied</dt>
          <dd>12 Oct 2026</dd>
        </div>
        <div>
          <dt>Previous school</dt>
          <dd>San Martín</dd>
        </div>
      </Facts>
    ),
  },
  argTypes: { avatar: { control: false }, status: { control: false }, facts: { control: false } },
} satisfies Meta<typeof DetailHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { level: 2, name: "Ana Torres" })).toBeVisible();
    await expect(canvas.getByRole("img", { name: "Ana Torres" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Approve" })).toBeVisible();
    await expect(canvas.getByText("Rosa Quispe")).toBeVisible();
  },
};

export const NameOnly: Story = {
  args: {
    avatar: undefined,
    subtitle: undefined,
    status: undefined,
    actions: undefined,
    facts: undefined,
  },
};

/** 360px container: actions and status wrap under the name. */
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="w-[360px] max-w-full">
        <Story />
      </div>
    ),
  ],
};
