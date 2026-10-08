import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { seriesColor } from "./palette.js";
import { PlotOverlay } from "./plot-overlay.js";

const WIDTH = 480;
const HEIGHT = 220;
const PLOT = { left: 16, top: 16, width: WIDTH - 32, height: HEIGHT - 44 };

const services = [
  { name: "Corte", value: 42 },
  { name: "Barba", value: 24 },
  { name: "Combo", value: 18 },
  { name: "Tinte", value: 9 },
  { name: "Afeitado", value: 7 },
];
const total = services.reduce((sum, service) => sum + service.value, 0);

/** A stacked share bar: each segment is one explorable point. */
function segmentAt(x: number) {
  let start = 0;
  for (let index = 0; index < services.length; index += 1) {
    start += ((services[index]?.value ?? 0) / total) * PLOT.width;
    if (x <= start) return index;
  }
  return null;
}

function OverlayDemo({ keys }: { keys: "horizontal" | "vertical" | "both" }) {
  const [active, setActive] = useState<number | null>(null);
  const current = active == null ? undefined : services[active];
  let offset = 0;
  return (
    <div className="relative" style={{ width: WIDTH, height: HEIGHT }}>
      <svg width={WIDTH} height={HEIGHT} role="img" aria-label="Servicios del mes">
        <title>Servicios del mes</title>
        <g transform={`translate(${PLOT.left},${PLOT.top})`}>
          {services.map((service, index) => {
            const width = (service.value / total) * PLOT.width;
            const x = offset;
            offset += width;
            return (
              <rect
                key={service.name}
                x={x}
                y={PLOT.height / 2 - 24}
                width={Math.max(0, width - 2)}
                height={48}
                rx={6}
                style={{
                  fill: seriesColor(index),
                  opacity: active == null || active === index ? 1 : 0.45,
                }}
              />
            );
          })}
        </g>
      </svg>
      <PlotOverlay
        {...PLOT}
        label="Servicios del mes. Usa las flechas para recorrerlos."
        count={services.length}
        active={active}
        valueText={current ? `${current.name}: ${current.value} atenciones` : "Servicios del mes"}
        onActiveChange={setActive}
        indexAt={({ x }) => segmentAt(x)}
        keys={keys}
      />
      <p className="m-0 text-[12px] text-ink-3" aria-live="polite">
        {current
          ? `${current.name}: ${current.value} atenciones`
          : "Enfoca o pasa el cursor sobre la barra."}
      </p>
    </div>
  );
}

const meta = {
  title: "Charts/Primitives/PlotOverlay",
  component: PlotOverlay,
  tags: ["autodocs"],
  args: {
    ...PLOT,
    label: "Servicios del mes. Usa las flechas para recorrerlos.",
    count: services.length,
    active: null,
    valueText: "Servicios del mes",
    onActiveChange: () => {},
    indexAt: () => null,
    keys: "horizontal",
  },
  argTypes: {
    keys: { control: "inline-radio", options: ["horizontal", "vertical", "both"] },
    label: { control: "text" },
    left: { control: false },
    top: { control: false },
    width: { control: false },
    height: { control: false },
    count: { control: false },
    active: { control: false },
    valueText: { control: false },
    onActiveChange: { control: false },
    indexAt: { control: false },
    onKey: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="@container max-w-full overflow-x-auto">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PlotOverlay>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Focusable `role="slider"` layer: pointer hover plus arrows, Home/End and Escape. */
export const Default: Story = {
  render: (args) => <OverlayDemo keys={args.keys ?? "horizontal"} />,
};

/** Up/Down step through the points, for vertical stacks. */
export const VerticalKeys: Story = {
  args: { keys: "vertical" },
  render: (args) => <OverlayDemo keys={args.keys ?? "vertical"} />,
};

export const BothAxesKeys: Story = {
  args: { keys: "both" },
  render: (args) => <OverlayDemo keys={args.keys ?? "both"} />,
};
