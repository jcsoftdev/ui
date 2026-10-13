import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
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

const frame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));

/**
 * A pointer that stays at one client point, re-hit-tested every frame the way the browser does
 * after layout or transform changes, firing the over/out pairs React turns into enter/leave.
 * Returns how many times the element under the pointer changed.
 */
async function holdPointer(x: number, y: number, ms: number, onFrame: () => void) {
  let current: Element | null = null;
  let changes = 0;
  const init = { bubbles: true, clientX: x, clientY: y, pointerType: "mouse", isPrimary: true };
  const end = performance.now() + ms;
  while (performance.now() < end) {
    const next = document.elementFromPoint(x, y);
    if (next !== current) {
      if (current)
        current.dispatchEvent(new PointerEvent("pointerout", { ...init, relatedTarget: next }));
      if (next)
        next.dispatchEvent(new PointerEvent("pointerover", { ...init, relatedTarget: current }));
      if (current) changes++;
      current = next;
    }
    next?.dispatchEvent(new PointerEvent("pointermove", init));
    await frame();
    onFrame();
  }
  return changes;
}

/** A point just inside the inner edge of the slice at its middle angle, at rest. */
function innerEdgePoint(slice: SVGPathElement, svg: SVGSVGElement) {
  const cx = svg.width.baseVal.value / 2;
  const cy = svg.height.baseVal.value / 2;
  let best: { x: number; y: number; r: number; deg: number }[] = [];
  for (let deg = 0; deg < 360; deg += 1) {
    const a = (deg * Math.PI) / 180;
    for (let r = 4; r < Math.min(cx, cy); r += 1) {
      const point = new DOMPoint(cx + Math.sin(a) * r, cy - Math.cos(a) * r);
      if (slice.isPointInFill(point)) {
        best.push({ x: point.x, y: point.y, r, deg });
        break;
      }
    }
  }
  const mid = best.reduce((sum, p) => sum + p.deg, 0) / best.length;
  best = best.sort((a, b) => Math.abs(a.deg - mid) - Math.abs(b.deg - mid));
  const pick = best[0] as { x: number; y: number; r: number; deg: number };
  const box = svg.getBoundingClientRect();
  const a = (pick.deg * Math.PI) / 180;
  // One pixel past the first filled radius, well inside the step-out distance.
  return { x: box.left + pick.x + Math.sin(a), y: box.top + pick.y - Math.cos(a) };
}

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
