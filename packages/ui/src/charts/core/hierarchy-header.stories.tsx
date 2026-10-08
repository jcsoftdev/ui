import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { ancestors, buildHierarchy, findNode } from "./hierarchy.js";
import {
  HIERARCHY_FRAME_CLASS,
  HierarchyHeader,
  resolveHierarchyLabels,
} from "./hierarchy-chart.js";

const root = buildHierarchy({
  name: "Servicios de octubre",
  children: [
    {
      name: "Miraflores",
      children: [
        {
          name: "Kevin",
          children: [
            { name: "Corte clásico", value: 64 },
            { name: "Barba", value: 22 },
          ],
        },
        { name: "Renzo", children: [{ name: "Degradado", value: 57 }] },
      ],
    },
    { name: "Barranco", children: [{ name: "Abel", children: [{ name: "Afeitado", value: 26 }] }] },
  ],
});

const labels = resolveHierarchyLabels({ breadcrumb: "Ruta de navegación" });
const deepest = findNode(root, "root/Miraflores/Kevin") ?? root;

function HeaderDemo({ start }: { start: string }) {
  const [focusId, setFocusId] = useState(start);
  const focus = findNode(root, focusId) ?? root;
  return <HierarchyHeader path={ancestors(focus)} onSelect={setFocusId} labels={labels} />;
}

const meta = {
  title: "Charts/Primitives/HierarchyHeader",
  component: HierarchyHeader,
  tags: ["autodocs"],
  args: { path: ancestors(deepest), onSelect: () => {}, labels },
  argTypes: {
    path: { control: false },
    onSelect: { control: false },
    labels: { control: false },
  },
  decorators: [
    (Story) => (
      <div className={`${HIERARCHY_FRAME_CLASS} flex w-[480px] max-w-full flex-col`}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HierarchyHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Drill-down path: every ancestor is a button; selecting one goes back up to it. */
export const Default: Story = {
  render: () => <HeaderDemo start={deepest.id} />,
};

export const AtRoot: Story = {
  args: { path: [root] },
};
