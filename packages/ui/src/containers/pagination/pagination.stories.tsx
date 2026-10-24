import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { Pagination } from "./pagination.js";

const meta = {
  title: "Containers/Pagination",
  component: Pagination,
  tags: ["autodocs"],
  args: { total: 134 },
} satisfies Meta<typeof Pagination>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("1–10 of 134")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Next page" }));
    await expect(canvas.getByText("11–20 of 134")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Last page" }));
    await expect(canvas.getByText("131–134 of 134")).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Next page" })).toBeDisabled();
  },
};

/** Controlled: the app owns the page and the page size, and slices or requests its rows. */
export const Controlled: Story = {
  render: function Render(args) {
    const [page, setPage] = useState(3);
    const [pageSize, setPageSize] = useState(25);
    return (
      <Pagination
        {...args}
        page={page}
        onPageChange={setPage}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
      />
    );
  },
};

export const Empty: Story = { args: { total: 0 } };

/** 320 px container: the picker, the range and the buttons wrap instead of overflowing. */
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="w-[320px] max-w-full">
        <Story />
      </div>
    ),
  ],
};
