import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { seriesColor } from "../palette.js";
import { PlotExplorer } from "./explorer.js";

const WIDTH = 480;
const HEIGHT = 220;
const MARGIN = { top: 16, right: 16, bottom: 28, left: 16 };
const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;

const cuts = [
  { name: "Kevin", value: 38 },
  { name: "Diego", value: 31 },
  { name: "Andrea", value: 27 },
  { name: "Mateo", value: 22 },
  { name: "Renzo", value: 18 },
];
const slot = plotWidth / cuts.length;
const max = Math.max(...cuts.map((cut) => cut.value));

function pick(x: number) {
  const index = Math.floor(x / slot);
  return index >= 0 && index < cuts.length ? index : null;
}

/** Bars drawn by hand so the explorer is the only interactive layer. */
function ExplorerDemo({ count, label }: { count: number; label: string }) {
  const [active, setActive] = useState<number | null>(null);
  const current = active == null ? undefined : cuts[active];
  return (
    <div className="relative" style={{ width: WIDTH, height: HEIGHT }}>
      <svg width={WIDTH} height={HEIGHT} role="img" aria-label="Cortes por barbero">
        <title>Cortes por barbero</title>
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {cuts.slice(0, count).map((cut, index) => {
            const barHeight = (cut.value / max) * plotHeight;
            return (
              <g key={cut.name}>
                <rect
                  x={index * slot + slot * 0.2}
                  y={plotHeight - barHeight}
                  width={slot * 0.6}
                  height={barHeight}
                  rx={6}
                  style={{ fill: seriesColor(index), opacity: active === index ? 1 : 0.7 }}
                />
                <text
                  x={index * slot + slot / 2}
                  y={plotHeight + 16}
                  textAnchor="middle"
                  className="fill-ink-3 text-[11px]"
                >
                  {cut.name}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      <PlotExplorer
        count={count}
        active={active}
        onActiveChange={setActive}
        pick={(x) => {
          const index = pick(x);
          return index != null && index < count ? index : null;
        }}
        label={label}
        valueText={current ? `${current.name}: ${current.value} cortes` : "Cortes por barbero"}
        margin={MARGIN}
        width={plotWidth}
        height={plotHeight}
      />
      <p className="m-0 mt-2 text-[12px] text-ink-3" aria-live="polite">
        {current
          ? `${current.name}: ${current.value} cortes`
          : "Enfoca o pasa el cursor sobre las barras."}
      </p>
    </div>
  );
}

const meta = {
  title: "Charts/Primitives/PlotExplorer",
  component: PlotExplorer,
  tags: ["autodocs"],
  args: {
    count: cuts.length,
    label: "Cortes por barbero. Usa las flechas para recorrerlos.",
    active: null,
    onActiveChange: () => {},
    pick: () => null,
    valueText: "Cortes por barbero",
    margin: MARGIN,
    width: plotWidth,
    height: plotHeight,
  },
  argTypes: {
    count: { control: { type: "range", min: 0, max: cuts.length, step: 1 } },
    label: { control: "text" },
    active: { control: false },
    onActiveChange: { control: false },
    pick: { control: false },
    valueText: { control: false },
    margin: { control: false },
    width: { control: false },
    height: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="@container max-w-full overflow-x-auto">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PlotExplorer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Transparent slider over the plot: hover, arrows, Home/End, PageUp/PageDown and Escape. */
export const Default: Story = {
  render: (args) => <ExplorerDemo count={args.count} label={args.label} />,
};

/** With no items the overlay leaves the tab order. */
export const Empty: Story = {
  args: { count: 0 },
  render: (args) => <ExplorerDemo count={args.count} label={args.label} />,
};
