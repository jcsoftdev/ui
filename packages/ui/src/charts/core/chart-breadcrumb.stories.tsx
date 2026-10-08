import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { ChartBreadcrumb, type ChartBreadcrumbItem } from "./breadcrumb.js";

const trail: ChartBreadcrumbItem[] = [
  { id: "todas", name: "Todas las sedes" },
  { id: "miraflores", name: "Miraflores" },
  { id: "cortes", name: "Cortes" },
  { id: "degradados", name: "Degradados" },
];

const meta = {
  title: "Charts/Primitives/ChartBreadcrumb",
  component: ChartBreadcrumb,
  tags: ["autodocs"],
  args: { items: trail, label: "Ruta de la jerarquía", onSelect: () => {} },
  argTypes: {
    items: { control: "object" },
    label: { control: "text" },
    onSelect: { action: "select" },
  },
} satisfies Meta<typeof ChartBreadcrumb>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const RootOnly: Story = { args: { items: trail.slice(0, 1) } };

/** Selecting an ancestor drills back out to it. */
export const Interactive: Story = {
  render: (args) => {
    const [depth, setDepth] = useState(trail.length);
    return (
      <ChartBreadcrumb
        {...args}
        items={trail.slice(0, depth)}
        onSelect={(id) => setDepth(trail.findIndex((item) => item.id === id) + 1)}
      />
    );
  },
};
