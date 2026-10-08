import type { Meta, StoryObj } from "@storybook/react-vite";
import { buildHierarchy } from "./hierarchy.js";
import { HierarchyTable, resolveHierarchyLabels } from "./hierarchy-chart.js";

const root = buildHierarchy({
  name: "Servicios de octubre",
  children: [
    {
      name: "Miraflores",
      children: [
        { name: "Kevin", value: 86 },
        { name: "Renzo", value: 97 },
      ],
    },
    { name: "Barranco", children: [{ name: "Abel", value: 68 }] },
    { name: "San Isidro", value: 64 },
  ],
});

const labels = resolveHierarchyLabels({ category: "Sede", share: "Participación" });

const meta = {
  title: "Charts/Primitives/HierarchyTable",
  component: HierarchyTable,
  tags: ["autodocs"],
  args: {
    root,
    caption: "Servicios por sede y barbero",
    format: (value: number) => `${value} servicios`,
    labels,
  },
  argTypes: {
    root: { control: false },
    caption: { control: "text" },
    format: { control: false },
    labels: { control: false },
  },
  decorators: [
    (Story) => (
      // The table is visually hidden inside charts; this wrapper reveals it for inspection.
      <div className="@container w-[560px] max-w-full overflow-x-auto [&_.sr-only]:not-sr-only [&_caption]:pb-2 [&_caption]:text-left [&_caption]:font-semibold [&_table]:w-full [&_table]:text-[12px] [&_td]:px-2 [&_td]:py-1 [&_td]:text-right [&_th]:px-2 [&_th]:py-1 [&_th]:text-left">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HierarchyTable>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The accessible table behind treemap, sunburst and icicle charts (revealed here). */
export const Default: Story = {};

/** Rooted at a branch, paths and shares are relative to it. */
export const FromBranch: Story = {
  args: { root: root.children[0] ?? root, caption: "Servicios de Miraflores" },
};
