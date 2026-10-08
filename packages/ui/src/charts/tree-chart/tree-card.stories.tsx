import type { Meta, StoryObj } from "@storybook/react-vite";
import { TreeCard } from "./tree-card.js";
import { buildTreeModel } from "./tree-model.js";

const { root } = buildTreeModel({
  name: "Diego Quispe",
  subtitle: "Barbero senior",
  badge: "Miraflores",
  children: [{ name: "Kevin Rojas", subtitle: "Aprendiz", badge: "3 clientes" }],
});

const idle = {
  highlighted: false,
  dimmed: false,
  active: false,
  collapsed: false,
  hasChildren: true,
};

const meta = {
  title: "Charts/Primitives/TreeCard",
  component: TreeCard,
  tags: ["autodocs"],
  args: { node: root, state: idle },
  argTypes: {
    node: { control: false },
    state: { control: "object" },
  },
  decorators: [
    (Story) => (
      <div className="@container h-[64px] w-[260px] max-w-full">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
} satisfies Meta<typeof TreeCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default node template: color rail, initials avatar, name, subtitle and badge. */
export const Default: Story = {};

/** On the highlighted path: the border takes the branch color. */
export const Highlighted: Story = { args: { state: { ...idle, highlighted: true } } };

export const Dimmed: Story = { args: { state: { ...idle, dimmed: true } } };

export const NameOnly: Story = {
  args: {
    node: buildTreeModel({ name: "Andrea Torres" }).root,
    state: { ...idle, hasChildren: false },
  },
};

export const WithPhoto: Story = {
  args: {
    node: buildTreeModel({
      name: "Renzo Paredes",
      subtitle: "Colorista",
      image:
        "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 36 36'><rect width='36' height='36' fill='%23c9a27a'/><circle cx='18' cy='14' r='6' fill='%23f3e3d0'/><rect x='6' y='23' width='24' height='13' rx='6' fill='%23f3e3d0'/></svg>",
    }).root,
  },
};
