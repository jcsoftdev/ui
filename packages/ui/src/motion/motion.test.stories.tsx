import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { CountUp } from "./count-up.js";
import { CrossFade } from "./cross-fade.js";
import { Reveal, Stagger } from "./reveal.js";
import { useHighlightRow } from "./use-highlight-row.js";

const meta = {
  title: "Tests/Motion",
  tags: ["!autodocs"],
  parameters: { layout: "centered" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Makes `(prefers-reduced-motion: reduce)` match for one story, as an OS setting would. */
function preferReducedMotion() {
  const original = window.matchMedia;
  window.matchMedia = (query: string) =>
    query.includes("prefers-reduced-motion: reduce")
      ? ({
          matches: true,
          media: query,
          onchange: null,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          dispatchEvent: () => false,
        } as MediaQueryList)
      : original.call(window, query);
  return () => {
    window.matchMedia = original;
  };
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function Panes() {
  const [id, setId] = useState(1);
  return (
    <CrossFade contentKey={id}>
      <section aria-label={`Detail ${id}`}>
        <p>Student {id}</p>
        <button type="button" onClick={() => setId((n) => n + 1)}>
          Next student
        </button>
      </section>
    </CrossFade>
  );
}

export const CrossFadeSwapsKeyedContent: Story = {
  render: () => <Panes />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const next = canvas.getByRole("button", { name: "Next student" });
    next.focus();
    await userEvent.click(next);
    const leaving = canvasElement.querySelector("[data-motion-leave]");
    await expect(leaving).toHaveAttribute("aria-hidden", "true");
    await expect(leaving).toHaveAttribute("inert");
    await expect(leaving).toHaveTextContent("Student 1");
    const detail = canvas.getByRole("region", { name: "Detail 2" });
    await expect(canvasElement.querySelector("[data-motion=enter]")).toHaveTextContent("Student 2");
    await expect(canvas.getAllByRole("button", { name: "Next student" })).toHaveLength(1);
    await expect(canvasElement.querySelector("[data-motion=enter]")).toContainElement(
      document.activeElement as HTMLElement,
    );
    await waitFor(() => expect(canvasElement.querySelector("[data-motion-leave]")).toBeNull());
    await waitFor(() => expect(detail).toBeVisible());
  },
};

export const CrossFadeReducedMotionSwapsAtOnce: Story = {
  beforeEach: preferReducedMotion,
  render: () => <Panes />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Next student" }));
    await expect(canvas.getByText("Student 2")).toBeVisible();
    await expect(canvas.queryByText("Student 1")).toBeNull();
    await expect(canvasElement.querySelector("[data-motion], [data-motion-leave]")).toBeNull();
  },
};

export const CountUpLandsOnTheFormattedValue: Story = {
  render: () => <CountUp value={1234.5} formatter={usd} data-testid="count" />,
  play: async ({ canvasElement }) => {
    const count = within(canvasElement).getByTestId("count");
    await waitFor(() => expect(count.textContent).toBe("$1,234.50"));
    await expect(count.querySelector("[aria-hidden]")).toBeNull();
  },
};

export const CountUpReducedMotionShowsTheFinalValue: Story = {
  beforeEach: preferReducedMotion,
  render: () => <CountUp value={1234.5} formatter={usd} data-testid="count" />,
  play: async ({ canvasElement }) => {
    const count = within(canvasElement).getByTestId("count");
    await expect(count.textContent).toBe("$1,234.50");
  },
};

export const RevealAndStaggerReducedMotionAreStatic: Story = {
  beforeEach: preferReducedMotion,
  render: () => (
    <div>
      <Reveal>Welcome</Reveal>
      <Stagger>
        <p>One</p>
        <p>Two</p>
      </Stagger>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Two")).toBeVisible();
    await expect(canvasElement.querySelector("[data-motion]")).toBeNull();
  },
};

export const StaggerKeepsChildrenInTheAccessibilityTree: Story = {
  render: () => (
    <Stagger as="ul" aria-label="Cards">
      <li>One</li>
      <li>Two</li>
      <li>Three</li>
    </Stagger>
  ),
  play: async ({ canvasElement }) => {
    const items = within(canvasElement).getAllByRole("listitem");
    await expect(items).toHaveLength(3);
    await expect(items[2]).toHaveAttribute("data-motion", "enter");
    await expect(items[2]?.style.getPropertyValue("--ui-motion-i")).toBe("2");
  },
};

function Rows() {
  const [ids, setIds] = useState(["a", "b"]);
  const { rowProps } = useHighlightRow(ids);
  return (
    <div>
      <button type="button" onClick={() => setIds((list) => [...list, "c"])}>
        Add
      </button>
      <ul>
        {ids.map((id) => (
          <li key={id} {...rowProps(id)}>
            Row {id}
          </li>
        ))}
      </ul>
    </div>
  );
}

export const HighlightRowPulsesOnlyNewRows: Story = {
  render: () => <Rows />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvasElement.querySelector("[data-motion-pulse]")).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Add" }));
    await waitFor(() =>
      expect(canvas.getByText("Row c")).toHaveAttribute("data-motion-pulse", "a"),
    );
    await expect(canvas.getByText("Row a")).not.toHaveAttribute("data-motion-pulse");
  },
};
