import type { Meta, StoryObj } from "@storybook/react-vite";
import { TreeChip } from "./tree-card.js";
import { buildTreeModel } from "./tree-model.js";

const { root } = buildTreeModel({
  name: "Diego Quispe",
  subtitle: "Barbero senior",
  children: [{ name: "Kevin Rojas" }],
});

const idle = {
  highlighted: false,
  dimmed: false,
  active: false,
  collapsed: false,
  hasChildren: true,
  descendants: 4,
  showCount: true,
  loading: false,
  matched: false,
  selected: false,
};

const meta = {
  title: "Charts/Primitives/TreeChip",
  component: TreeChip,
  tags: ["autodocs"],
  args: { node: root, state: idle },
  argTypes: { node: { control: false }, state: { control: "object" } },
  decorators: [
    (Story) => (
      <div className="h-[28px] w-[180px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TreeChip>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Compact node template of the radial and dendrogram layouts. */
export const Default: Story = {};

export const Highlighted: Story = { args: { state: { ...idle, highlighted: true } } };

export const WithoutCount: Story = { args: { state: { ...idle, showCount: false } } };
