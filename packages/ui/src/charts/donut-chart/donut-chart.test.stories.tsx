import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { frame, holdPointer, innerEdgePoint, tapAndLift } from "../core/pointer.test-utils.js";
import { DonutChart } from "./donut-chart.js";

const meta = {
  title: "Tests/DonutChart",
  tags: ["!autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const revenueByService = [
  { id: "corte", name: "Corte clásico", value: 7200 },
  { id: "corte-barba", name: "Corte + barba", value: 3100 },
  { id: "degradado", name: "Degradado", value: 2800 },
  { id: "barba", name: "Perfilado de barba", value: 1200 },
  { id: "navaja", name: "Afeitado con navaja", value: 2400 },
];

export const HoverStaysStill: Story = {
  render: () => (
    <div style={{ width: 420, padding: 16 }}>
      <DonutChart
        title="Ingresos por servicio"
        data={revenueByService}
        valueFormat="currency"
        legend={false}
        height={220}
        animate={false}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const svg = (await canvas.findByRole("img", {
      name: "Ingresos por servicio",
    })) as unknown as SVGSVGElement;
    const slices = Array.from(svg.querySelectorAll<SVGPathElement>("[data-slice]"));
    await waitFor(() => expect(slices.length).toBe(5));
    const target = slices[4] as SVGPathElement;
    const point = innerEdgePoint(target, svg);
    const container = svg.parentElement as HTMLElement;
    const tooltip = () => container.querySelector<HTMLElement>(":scope > [aria-hidden='true']");

    let tooltipToggles = 0;
    let hadTooltip = false;
    let minOpacity = 1;
    const changes = await holdPointer(point.x, point.y, 1000, () => {
      const shown = tooltip() != null;
      if (shown !== hadTooltip) tooltipToggles++;
      hadTooltip = shown;
      minOpacity = Math.min(minOpacity, Number(getComputedStyle(target).opacity));
    });

    // The pointer settles on the slice once and never drops it while it stays still.
    await expect(changes).toBe(0);
    await expect(tooltipToggles).toBe(1);
    await expect(tooltip()).toHaveTextContent("Afeitado con navaja");
    await expect(svg).toHaveTextContent("S/ 2 400.00");

    // The hovered slice stays fully painted, and the other slices dim.
    await expect(minOpacity).toBe(1);
    const box = target.getBoundingClientRect();
    await expect(box.width).toBeGreaterThan(0);
    await expect(box.height).toBeGreaterThan(0);
    await expect(getComputedStyle(slices[0] as Element).opacity).toBe("0.4");

    // The card stays inside the chart.
    const card = (tooltip() as HTMLElement).getBoundingClientRect();
    const bounds = container.getBoundingClientRect();
    await expect(card.top).toBeGreaterThanOrEqual(bounds.top);
    await expect(card.bottom).toBeLessThanOrEqual(bounds.bottom);
    await expect(card.left).toBeGreaterThanOrEqual(bounds.left);
    await expect(card.right).toBeLessThanOrEqual(bounds.right);
  },
};

export const TapKeepsDetails: Story = {
  render: () => (
    <div style={{ width: 320, padding: 16 }}>
      <DonutChart
        title="Ingresos por servicio"
        data={revenueByService}
        valueFormat="currency"
        legend={false}
        height={220}
        animate={false}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const svg = (await canvas.findByRole("img", {
      name: "Ingresos por servicio",
    })) as unknown as SVGSVGElement;
    const hits = Array.from(svg.querySelectorAll<SVGPathElement>("[data-slice-hit]"));
    await waitFor(() => expect(hits.length).toBe(5));
    const container = svg.parentElement as HTMLElement;
    const tooltip = () => container.querySelector<HTMLElement>(":scope > [aria-hidden='true']");

    // Lifting the finger fires pointerleave; the tapped slice stays picked instead of flashing.
    await tapAndLift(hits[0] as SVGPathElement, "touch");
    for (let i = 0; i < 10; i++) await frame();
    await expect(tooltip()).toHaveTextContent("Corte clásico");
    await expect(svg).toHaveTextContent("S/ 7 200.00");

    await tapAndLift(hits[1] as SVGPathElement, "touch");
    await frame();
    await expect(tooltip()).toHaveTextContent("Corte + barba");

    // A press outside the slices lets the details go.
    document.body.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, pointerType: "touch", isPrimary: true }),
    );
    await waitFor(() => expect(tooltip()).toBeNull());

    // A mouse leaving still drops the hover at once.
    await tapAndLift(hits[2] as SVGPathElement, "mouse");
    await waitFor(() => expect(tooltip()).toBeNull());
  },
};
