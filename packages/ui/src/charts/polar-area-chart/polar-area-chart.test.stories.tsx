import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { frame, holdPointer, innerEdgePoint, tapAndLift } from "../core/pointer.test-utils.js";
import { PolarAreaChart } from "./polar-area-chart.js";

const meta = {
  title: "Tests/PolarAreaChart",
  tags: ["!autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const weekday = [
  { id: "lun", name: "Lunes", value: 18 },
  { id: "mar", name: "Martes", value: 24 },
  { id: "mie", name: "Miércoles", value: 27 },
  { id: "jue", name: "Jueves", value: 33 },
  { id: "vie", name: "Viernes", value: 46 },
];

const chart = (
  <div style={{ width: 420, padding: 16 }}>
    <PolarAreaChart
      title="Citas por día"
      data={weekday}
      valueFormat="integer"
      legend={false}
      height={300}
      animate={false}
    />
  </div>
);

export const HoverStaysStill: Story = {
  render: () => chart,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const svg = (await canvas.findByRole("img", {
      name: "Citas por día",
    })) as unknown as SVGSVGElement;
    const sectors = Array.from(svg.querySelectorAll<SVGPathElement>("[data-sector]"));
    await waitFor(() => expect(sectors.length).toBe(5));
    const target = sectors[2] as SVGPathElement;
    const point = innerEdgePoint(target, svg);
    const container = svg.parentElement as HTMLElement;
    const tooltip = () => container.querySelector<HTMLElement>(":scope > [aria-hidden='true']");

    let tooltipToggles = 0;
    let hadTooltip = false;
    const changes = await holdPointer(point.x, point.y, 1000, () => {
      const shown = tooltip() != null;
      if (shown !== hadTooltip) tooltipToggles++;
      hadTooltip = shown;
    });

    // The stepped-out sector leaves the still pointer, but the resting hit area keeps the hover.
    await expect(changes).toBe(0);
    await expect(tooltipToggles).toBe(1);
    await expect(tooltip()).toHaveTextContent("Miércoles");
    await expect(getComputedStyle(sectors[0] as Element).opacity).toBe("0.4");

    const card = (tooltip() as HTMLElement).getBoundingClientRect();
    const bounds = container.getBoundingClientRect();
    await expect(card.top).toBeGreaterThanOrEqual(bounds.top);
    await expect(card.bottom).toBeLessThanOrEqual(bounds.bottom);
  },
};

export const TapKeepsDetails: Story = {
  render: () => chart,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const svg = (await canvas.findByRole("img", {
      name: "Citas por día",
    })) as unknown as SVGSVGElement;
    const hits = Array.from(svg.querySelectorAll<SVGPathElement>("[data-sector-hit]"));
    await waitFor(() => expect(hits.length).toBe(5));
    const container = svg.parentElement as HTMLElement;
    const tooltip = () => container.querySelector<HTMLElement>(":scope > [aria-hidden='true']");

    await tapAndLift(hits[3] as SVGPathElement, "touch");
    for (let i = 0; i < 10; i++) await frame();
    await expect(tooltip()).toHaveTextContent("Jueves");

    document.body.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, pointerType: "touch", isPrimary: true }),
    );
    await waitFor(() => expect(tooltip()).toBeNull());
  },
};
