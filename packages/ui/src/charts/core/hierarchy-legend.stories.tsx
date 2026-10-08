import type { Meta, StoryObj } from "@storybook/react-vite";
import { buildHierarchy, findNode } from "./hierarchy.js";
import { HIERARCHY_FRAME_CLASS, HierarchyLegend } from "./hierarchy-chart.js";

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
    { name: "San Isidro", children: [{ name: "Luis", value: 64 }] },
    { name: "Surco", children: [{ name: "Diego", value: 70 }] },
    { name: "La Molina", value: 35 },
  ],
});

const miraflores = findNode(root, "root/Miraflores") ?? root;

const meta = {
  title: "Charts/Primitives/HierarchyLegend",
  component: HierarchyLegend,
  tags: ["autodocs"],
  args: { focus: root, limit: 8 },
  argTypes: {
    focus: { control: false },
    limit: { control: { type: "range", min: 1, max: 12, step: 1 } },
  },
  decorators: [
    (Story) => (
      <div className={`${HIERARCHY_FRAME_CLASS} flex w-[480px] max-w-full flex-col`}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HierarchyLegend>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Read-only legend of the open level's branches, colored like the chart. */
export const Default: Story = {};

/** Opening a branch lists its children instead. */
export const DrilledIn: Story = { args: { focus: miraflores } };

export const Limited: Story = { args: { limit: 3 } };

/** A leaf has no branches, so nothing is rendered. */
export const Leaf: Story = {
  args: { focus: findNode(root, "root/La Molina") ?? root },
  render: (args) => (
    <>
      <HierarchyLegend {...args} />
      <p className="m-0 text-[12px] text-ink-3">Sin ramas: la leyenda no se muestra.</p>
    </>
  ),
};
