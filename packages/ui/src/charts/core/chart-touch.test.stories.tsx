import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { BarChart } from "../bar-chart/bar-chart.js";
import { RadialBarChart } from "../radial-bar-chart/radial-bar-chart.js";
import { WaffleChart } from "../waffle-chart/waffle-chart.js";
import { resolveDocked } from "./chart-dock.js";
import { frame, moveTo, pointInside, tapAt } from "./pointer.test-utils.js";

const meta = {
  title: "Tests/ChartTouch",
  tags: ["!autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const barbers = ["Kevin", "Renzo", "Abel", "Diego", "Luis"];
const series = [{ id: "citas", name: "Citas", data: [42, 38, 51, 29, 35] }];

const card = (root: HTMLElement) =>
  root.querySelector<HTMLElement>("[data-chart-tooltip]:not([data-docked])");
const details = (root: HTMLElement) => root.querySelector<HTMLElement>("[data-chart-tooltip]");

const sliderOf = (root: HTMLElement) => {
  const slider = root.querySelector<HTMLElement>("[role='slider']");
  if (!slider) throw new Error("no slider");
  return slider;
};

/** Which side of the pointer the card is on: its centre against the pointer x. */
const sideOf = (root: HTMLElement, pointerX: number) => {
  const box = (card(root) as HTMLElement).getBoundingClientRect();
  return box.left + box.width / 2 < pointerX ? "left" : "right";
};

export const TooltipSideHasADeadZone: Story = {
  name: "A: jitter across the old threshold does not swap sides",
  render: () => (
    <div style={{ width: 720, padding: 16 }}>
      <BarChart
        title="Citas por barbero"
        categories={barbers}
        series={series}
        orientation="horizontal"
        valueFormat="integer"
        legend={false}
        height={260}
        animate={false}
        dock="never"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const root = canvasElement as HTMLElement;
    const slider = await waitFor(() => sliderOf(root));
    const box = (slider.offsetParent as HTMLElement).getBoundingClientRect();
    const y = slider.getBoundingClientRect().top + slider.getBoundingClientRect().height * 0.3;
    const at = (share: number) => ({ x: box.left + box.width * share, y });
    const run = async (start: number) => {
      await moveTo(at(start));
      await waitFor(() => expect(card(root)).not.toBeNull());
      const first = sideOf(root, at(start).x);
      await moveTo(at(0.6));
      await new Promise((resolve) => setTimeout(resolve, 250));
      const lefts: number[] = [];
      for (let k = 0; k < 24; k++) {
        await moveTo(at(0.6 + (k % 2 ? 0.012 : -0.012)));
        lefts.push((card(root) as HTMLElement).getBoundingClientRect().left);
      }
      // A swap would move the card by its own width (130px+) across the pointer.
      return { first, travel: Math.max(...lefts) - Math.min(...lefts) };
    };
    const fromRight = await run(0.3);
    await expect(fromRight.first).toBe("right");
    await expect(fromRight.travel).toBeLessThan(40);
    slider.dispatchEvent(new PointerEvent("pointerleave", { pointerType: "mouse" }));
    await moveTo({ x: box.left - 40, y: box.top - 40 });
    const fromLeft = await run(0.9);
    await expect(fromLeft.first).toBe("left");
    await expect(fromLeft.travel).toBeLessThan(40);
  },
};

export const TapThenLiftKeepsTheTooltip: Story = {
  name: "B: a touch tap keeps the tooltip after the finger lifts",
  render: () => (
    <div style={{ width: 720, padding: 16 }}>
      <RadialBarChart
        title="Actividad del día"
        data={[
          { id: "citas", name: "Citas", value: 80 },
          { id: "ventas", name: "Ventas", value: 62 },
          { id: "reseñas", name: "Reseñas", value: 45 },
        ]}
        max={100}
        height={320}
        animate={false}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const root = canvasElement as HTMLElement;
    const rings = await waitFor(() => {
      const found = Array.from(root.querySelectorAll<SVGPathElement>("[data-chart-hit]"));
      expect(found.length).toBe(3);
      return found;
    });
    const p1 = pointInside(rings[1] as SVGPathElement);
    await tapAt(p1);
    await expect(card(root)).toHaveTextContent("Ventas");
    for (let i = 0; i < 20; i++) await frame();
    await expect(card(root)).toHaveTextContent("Ventas");

    // Tapping another ring moves the pin; tapping it again unpins.
    await tapAt(pointInside(rings[2] as SVGPathElement));
    await expect(card(root)).toHaveTextContent("Reseñas");
    await tapAt(pointInside(rings[2] as SVGPathElement));
    await waitFor(() => expect(card(root)).toBeNull());

    // Tapping outside the plot unpins; so does Escape.
    await tapAt(pointInside(rings[0] as SVGPathElement));
    await expect(card(root)).toHaveTextContent("Citas");
    document.body.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, pointerType: "touch" }),
    );
    await waitFor(() => expect(card(root)).toBeNull());
    await tapAt(pointInside(rings[0] as SVGPathElement));
    await expect(card(root)).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await waitFor(() => expect(card(root)).toBeNull());
  },
};

export const SwipeNeverSelects: Story = {
  name: "B: a swipe over a mark selects nothing",
  render: () => (
    <div style={{ width: 720, padding: 16 }}>
      <RadialBarChart
        title="Actividad del día"
        data={[
          { id: "citas", name: "Citas", value: 80 },
          { id: "ventas", name: "Ventas", value: 62 },
        ]}
        max={100}
        height={320}
        animate={false}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const root = canvasElement as HTMLElement;
    const ring = await waitFor(() => {
      const found = root.querySelector<SVGPathElement>("[data-chart-hit]");
      expect(found).not.toBeNull();
      return found as SVGPathElement;
    });
    await tapAt(pointInside(ring), "touch", { travel: 40 });
    for (let i = 0; i < 6; i++) await frame();
    await expect(details(root)).toBeNull();
  },
};

export const CartesianTapPinsTheTappedCategory: Story = {
  name: "B': a tap on the 3rd category shows the 3rd category",
  render: () => (
    <div style={{ width: 720, padding: 16 }}>
      <BarChart
        title="Citas por barbero"
        categories={barbers}
        series={series}
        valueFormat="integer"
        legend={false}
        height={260}
        animate={false}
        dock="never"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const root = canvasElement as HTMLElement;
    const slider = await waitFor(() => sliderOf(root));
    const box = slider.getBoundingClientRect();
    const third = { x: box.left + box.width * 0.5, y: box.top + box.height * 0.5 };
    await tapAt(third);
    for (let i = 0; i < 12; i++) await frame();
    await expect(card(root)).toHaveTextContent("Abel");
    await expect(card(root)).toHaveTextContent("51");
    await expect(card(root)).not.toHaveTextContent("Kevin");
    // The tap's focus did not select the first category on top of it.
    await expect(slider).toHaveAttribute("aria-valuetext", expect.stringContaining("Abel"));
  },
};

export const GapsKeepTheCategory: Story = {
  name: "C: a pointer path through a same-category gap never hides the tooltip",
  render: () => (
    <div style={{ width: 520, padding: 16 }}>
      <WaffleChart
        title="Turnos"
        data={[
          { id: "reservados", name: "Reservados", value: 58 },
          { id: "libres", name: "Libres", value: 42 },
        ]}
        rows={5}
        columns={20}
        gap={0.5}
        height={200}
        legend={false}
        animate={false}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const root = canvasElement as HTMLElement;
    const units = await waitFor(() => {
      const found = Array.from(root.querySelectorAll<SVGElement>("[data-category='0'] > *"));
      expect(found.length).toBeGreaterThan(10);
      return found;
    });
    const rects = units.map((unit) => unit.getBoundingClientRect());
    const first = rects[0] as DOMRect;
    const next = rects.find(
      (rect) =>
        Math.abs(rect.top - first.top) < 1 &&
        rect.left > first.right + 1 &&
        rect.left - first.right < 30,
    ) as DOMRect;
    await expect(next).toBeDefined();
    const y = first.top + first.height / 2;
    const path: number[] = [];
    for (let x = first.left + first.width / 2; x <= next.left + next.width / 2; x += 1)
      path.push(x);

    await moveTo({ x: path[0] as number, y });
    await waitFor(() => expect(card(root)).toHaveTextContent("Reservados"));
    let hidden = 0;
    let crossedGap = false;
    for (const x of path) {
      await moveTo({ x, y });
      const under = document.elementFromPoint(x, y);
      if (!under?.closest("[data-category]")) crossedGap = true;
      if (card(root) == null) hidden++;
    }
    await expect(crossedGap).toBe(true);
    await expect(hidden).toBe(0);
    await expect(card(root)).toHaveTextContent("Reservados");
  },
};

const dockedChart = (width: number, dock?: "auto" | "always" | "never") => (
  <div style={{ width, padding: 0 }}>
    <BarChart
      title="Citas por barbero"
      categories={barbers}
      series={series}
      valueFormat="integer"
      legend={false}
      height={220}
      animate={false}
      dock={dock}
    />
    <p id="below" style={{ margin: 0 }}>
      Contenido debajo del gráfico
    </p>
  </div>
);

export const DocksOnAPhone: Story = {
  name: "Dock: docked details are a panel in flow and nothing shifts",
  render: () => dockedChart(390, "always"),
  play: async ({ canvasElement }) => {
    const root = canvasElement as HTMLElement;
    const below = root.querySelector("#below") as HTMLElement;
    const slider = await waitFor(() => sliderOf(root));
    const slot = await waitFor(() => {
      const found = root.querySelector<HTMLElement>("[data-chart-dock]");
      expect(found).not.toBeNull();
      return found as HTMLElement;
    });
    const before = below.getBoundingClientRect().top;
    await expect(slot.getAttribute("aria-hidden")).toBe("true");
    await expect(root.querySelector("[role='status'][aria-live='polite']")).not.toBeNull();
    await expect(getComputedStyle(slot).position).toBe("static");

    const box = slider.getBoundingClientRect();
    await tapAt({ x: box.left + box.width * 0.7, y: box.top + box.height * 0.5 });
    for (let i = 0; i < 10; i++) await frame();
    const panel = await waitFor(() => {
      const found = slot.querySelector<HTMLElement>("[data-docked]");
      expect(found).not.toBeNull();
      return found as HTMLElement;
    });
    await expect(panel).toHaveTextContent("Diego");
    await expect(getComputedStyle(panel).position).toBe("static");
    await expect(card(root)).toBeNull();
    await expect(panel.getBoundingClientRect().width).toBeGreaterThan(300);
    for (const row of Array.from(panel.querySelectorAll<HTMLElement>("div.flex.items-center"))) {
      await expect(row.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    }
    await expect(below.getBoundingClientRect().top).toBe(before);

    // Unpinning leaves the reserved space where it was.
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await waitFor(() => expect(slot.querySelector("[data-docked]")).toBeNull());
    await expect(below.getBoundingClientRect().top).toBe(before);
  },
};

export const FloatsOnDesktop: Story = {
  name: "Dock: a wide chart on a fine pointer keeps the floating card",
  render: () => dockedChart(720),
  play: async ({ canvasElement }) => {
    const root = canvasElement as HTMLElement;
    const slider = await waitFor(() => sliderOf(root));
    const box = slider.getBoundingClientRect();
    await moveTo({ x: box.left + box.width * 0.3, y: box.top + box.height * 0.5 });
    await waitFor(() => expect(card(root)).not.toBeNull());
    // The panel is in the DOM for SSR but display:none, so it reserves nothing.
    const slot = root.querySelector("[data-chart-dock]") as HTMLElement;
    await expect(getComputedStyle(slot).display).toBe("none");
    await expect(slot.getBoundingClientRect().height).toBe(0);
    await expect(resolveDocked("auto", false)).toBe(false);
    await expect(resolveDocked("auto", true)).toBe(true);
    await expect(resolveDocked("always", false)).toBe(true);
    await expect(resolveDocked("never", true)).toBe(false);
    await expect(within(root).queryByText("Contenido debajo del gráfico")).not.toBeNull();
  },
};

export const DockAlwaysOnADesktop: Story = {
  name: "Dock: always docks a wide chart too",
  render: () => dockedChart(720, "always"),
  play: async ({ canvasElement }) => {
    const root = canvasElement as HTMLElement;
    const slider = await waitFor(() => sliderOf(root));
    const slot = await waitFor(() => root.querySelector("[data-chart-dock]") as HTMLElement);
    await expect(slot).not.toBeNull();
    const box = slider.getBoundingClientRect();
    await moveTo({ x: box.left + box.width * 0.3, y: box.top + box.height * 0.5 });
    await waitFor(() => expect(slot.querySelector("[data-docked]")).not.toBeNull());
    await expect(card(root)).toBeNull();
  },
};
