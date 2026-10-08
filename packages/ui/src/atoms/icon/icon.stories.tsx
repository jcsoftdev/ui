import type { Meta, StoryObj } from "@storybook/react-vite";
import { Scissors } from "lucide-react";
import { Icon } from "./icon.js";
import { icons } from "./icon-map.js";

const names = Object.keys(icons) as (keyof typeof icons)[];

const meta = {
  title: "Atoms/Icon",
  component: Icon,
  tags: ["autodocs"],
  args: { name: "calendar", className: "size-6 text-ink" },
  argTypes: {
    name: { control: "select", options: names },
    icon: { control: false },
    label: { control: "text" },
    className: { control: "text" },
  },
} satisfies Meta<typeof Icon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithLabel: Story = { args: { name: "bell", label: "Notificaciones" } };

export const CustomLucideIcon: Story = { args: { icon: Scissors, name: undefined } };

export const Registry: Story = {
  render: (args) => (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-3">
      {names.map((name) => (
        <li key={name} className="flex flex-col items-center gap-1 text-ink-2 text-meta">
          <Icon {...args} name={name} />
          {name}
        </li>
      ))}
    </ul>
  ),
};
