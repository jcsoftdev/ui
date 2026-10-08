import type { Meta, StoryObj } from "@storybook/react-vite";
import { ExportMenu } from "./export-menu.js";

const meta = {
  title: "Charts/Primitives/ExportMenu",
  component: ExportMenu,
  tags: ["autodocs"],
  args: {
    title: "Ingresos semanales",
    getSvgs: (root) => Array.from(root.parentElement?.parentElement?.querySelectorAll("svg") ?? []),
  },
  argTypes: { getSvgs: { control: false }, getLeading: { control: false } },
  render: (args) => (
    <div className="grid max-w-[360px] gap-3">
      <div className="flex items-center justify-between gap-3">
        <strong className="text-[13px] text-ink">Ingresos semanales (S/)</strong>
        <ExportMenu {...args} />
      </div>
      <svg viewBox="0 0 240 80" role="img" aria-label="Ingresos por día" className="w-full">
        <title>Ingresos por día</title>
        {[35, 52, 44, 68, 80, 60].map((value, index) => (
          <rect
            key={value}
            x={index * 40 + 6}
            y={80 - value}
            width={28}
            height={value}
            rx={4}
            style={{ fill: "var(--chart-cat-1)" }}
          />
        ))}
      </svg>
    </div>
  ),
} satisfies Meta<typeof ExportMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Downloads the sibling drawing as SVG or PNG. */
export const Default: Story = {};

export const Spanish: Story = {
  args: { texts: { export: "Exportar", svg: "SVG", png: "PNG" } },
};
