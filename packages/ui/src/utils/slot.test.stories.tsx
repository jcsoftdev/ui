import type { Meta, StoryObj } from "@storybook/react-vite";
import { createRef } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { Button } from "../atoms/button/button.js";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../overlays/hover-card/hover-card.js";
import { Slot } from "./slot.js";

const meta = {
  title: "Tests/Slot",
  tags: ["!autodocs"],
  parameters: { layout: "centered" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const MergesPropsAndHandlers: Story = {
  render: () => {
    const order: string[] = [];
    const ref = createRef<HTMLElement>();
    let childRef: HTMLElement | null = null;
    return (
      <Slot
        ref={ref}
        className="from-slot"
        style={{ color: "red", margin: 1 }}
        aria-describedby="slot-hint"
        onClick={() => order.push("slot")}
      >
        {/* biome-ignore lint/a11y/useValidAnchor: the test needs a real link with a click handler */}
        <a
          href="#x"
          className="from-child"
          style={{ color: "blue" }}
          aria-describedby="child-hint"
          ref={(node) => {
            childRef = node;
          }}
          onClick={(event) => {
            event.preventDefault();
            order.push("child");
            (event.currentTarget as HTMLElement).dataset.order = order.join(",");
            (event.currentTarget as HTMLElement).dataset.refs = String(
              ref.current === childRef && childRef !== null,
            );
          }}
        >
          Enlace
        </a>
      </Slot>
    );
  },
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole("link", { name: "Enlace" });
    await expect(link.tagName).toBe("A");
    await expect(link).toHaveClass("from-slot", "from-child");
    await expect(link).toHaveStyle({ color: "rgb(0, 0, 255)", margin: "1px" });
    await expect(link).toHaveAttribute("aria-describedby", "child-hint slot-hint");
    await userEvent.click(link);
    await expect(link.dataset.order).toBe("child");
    await expect(link.dataset.refs).toBe("true");
  },
};

const onFirst = fn();
const onSecond = fn();

export const ButtonAsChildBothHandlers: Story = {
  render: () => (
    <Button
      asChild
      className="extra"
      onClick={() => {
        onSecond();
      }}
    >
      {/* biome-ignore lint/a11y/useValidAnchor: the test needs a real link with a click handler */}
      <a
        href="#destino"
        onClick={(event) => {
          event.preventDefault();
          onFirst();
        }}
      >
        Ir
      </a>
    </Button>
  ),
  play: async ({ canvasElement }) => {
    onFirst.mockClear();
    onSecond.mockClear();
    const link = within(canvasElement).getByRole("link", { name: "Ir" });
    await expect(link).toHaveClass("extra", "inline-flex");
    await userEvent.click(link);
    await expect(onFirst).toHaveBeenCalledTimes(1);
    await expect(onSecond).toHaveBeenCalledTimes(1);
    await expect(onFirst.mock.invocationCallOrder[0]).toBeLessThan(
      onSecond.mock.invocationCallOrder[0] ?? 0,
    );
  },
};

export const HoverCardTriggerAsChildOpens: Story = {
  render: () => (
    <HoverCard openDelay={0} closeDelay={0}>
      <HoverCardTrigger asChild>
        <a href="#diego">@diego</a>
      </HoverCardTrigger>
      <HoverCardContent>Barbero senior</HoverCardContent>
    </HoverCard>
  ),
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole("link", { name: "@diego" });
    await expect(link.tagName).toBe("A");
    await userEvent.hover(link);
    await within(document.body).findByText("Barbero senior");
    await userEvent.unhover(link);
    await userEvent.tab();
    await expect(link).toHaveFocus();
    await within(document.body).findByText("Barbero senior");
  },
};
