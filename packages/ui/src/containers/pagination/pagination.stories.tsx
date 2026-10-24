import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { UiStringsProvider } from "../../i18n/index.js";
import { CursorPagination } from "./cursor-pagination.js";
import { Pagination } from "./pagination.js";
import { usePagination } from "./use-pagination.js";

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

/** `variant="pages"`: the range, Previous, page numbers with gaps, and Next. */
export const Pages: Story = {
  render: function Render() {
    const [page, setPage] = useState(1);
    return (
      <Pagination variant="pages" total={234} pageSize={25} page={page} onPageChange={setPage} />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Showing 1–25 of 234")).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Previous" })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "Page 1" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await userEvent.click(canvas.getByRole("button", { name: "Page 10" }));
    await expect(canvas.getByText("Showing 226–234 of 234")).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Next" })).toBeDisabled();
    await userEvent.click(canvas.getByRole("button", { name: "Previous" }));
    await expect(canvas.getByRole("button", { name: "Page 9" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    for (const button of canvas.getAllByRole("button")) {
      await expect(Math.round(button.getBoundingClientRect().height)).toBe(30);
    }
  },
};

/** Spanish strings come from `UiStringsProvider`. */
export const PagesSpanish: Story = {
  render: () => (
    <UiStringsProvider locale="es">
      <Pagination variant="pages" total={134} pageSize={25} defaultPage={2} />
    </UiStringsProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Mostrando 26–50 de 134")).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Anterior" })).toBeEnabled();
    await expect(canvas.getByRole("button", { name: "Siguiente" })).toBeEnabled();
    await expect(canvas.getByRole("navigation", { name: "Paginación" })).toBeInTheDocument();
  },
};

/** With every row on one page the `pages` variant renders nothing. */
export const PagesSinglePage: Story = {
  render: () => (
    <div data-testid="slot">
      <Pagination variant="pages" total={12} pageSize={25} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByTestId("slot")).toBeEmptyDOMElement();
  },
};

const NAMES = Array.from({ length: 120 }, (_, i) => `Student ${i + 1}`);

/** `usePagination` slices a client-side list and returns to page 1 when the filter changes. */
export const ClientSide: Story = {
  render: function Render() {
    const [query, setQuery] = useState("");
    const rows = NAMES.filter((name) => name.includes(query));
    const pager = usePagination(rows, query, 25);
    return (
      <div className="grid gap-2">
        <input
          aria-label="Filter"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-control-sm rounded-input border-control px-2"
        />
        <ul data-testid="rows" className="m-0 list-none p-0 text-fs-125">
          {pager.items.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
        <Pagination
          variant="pages"
          total={pager.total}
          pageSize={pager.pageSize}
          page={pager.page}
          onPageChange={pager.setPage}
        />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Page 5" }));
    await expect(canvas.getByText("Showing 101–120 of 120")).toBeInTheDocument();
    await userEvent.type(canvas.getByRole("textbox", { name: "Filter" }), "1");
    await expect(canvas.getByText("Showing 1–25 of 40")).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Page 1" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  },
};

/** Cursor paging, total unknown: the range on screen and Previous / Next. */
export const Cursor: Story = {
  render: function Render() {
    const [page, setPage] = useState(1);
    const count = page < 3 ? 25 : 7;
    return (
      <CursorPagination
        page={page}
        count={count}
        hasNext={page < 3}
        onPrevious={() => setPage((p) => p - 1)}
        onNext={() => setPage((p) => p + 1)}
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Showing 1–25")).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Previous" })).toBeDisabled();
    await userEvent.click(canvas.getByRole("button", { name: "Next" }));
    await userEvent.click(canvas.getByRole("button", { name: "Next" }));
    await expect(canvas.getByText("Showing 51–57")).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Next" })).toBeDisabled();
  },
};

/** A first page with no next cursor renders nothing. */
export const CursorSinglePage: Story = {
  render: () => (
    <div data-testid="slot">
      <CursorPagination
        page={1}
        count={8}
        hasNext={false}
        onPrevious={() => {}}
        onNext={() => {}}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByTestId("slot")).toBeEmptyDOMElement();
  },
};
