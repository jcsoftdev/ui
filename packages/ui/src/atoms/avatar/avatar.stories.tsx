import type { Meta, StoryObj } from "@storybook/react-vite";
import { Avatar } from "./avatar.js";

const meta = {
  title: "Atoms/Avatar",
  component: Avatar,
  tags: ["autodocs"],
  args: { name: "Diego Quispe", size: "md" },
  argTypes: {
    name: { control: "text" },
    src: { control: "text" },
    size: { control: "inline-radio", options: ["md", "lg"] },
    highlighted: { control: "boolean" },
  },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Large: Story = { args: { size: "lg" } };

export const Highlighted: Story = { args: { highlighted: true, name: "Marco Ríos" } };

export const SingleName: Story = { args: { name: "Lucho" } };

export const Team: Story = {
  render: (args) => (
    <div className="flex items-center gap-2">
      {["Diego Quispe", "Marco Ríos", "Lucho", "Andrés Paredes Soto"].map((name, i) => (
        <Avatar key={name} {...args} name={name} highlighted={i === 0} />
      ))}
    </div>
  ),
};

export const Tones: Story = {
  render: (args) => (
    <div className="flex items-center gap-2">
      {(["neutral", "accent", "success", "warning", "danger", "info"] as const).map((tone) => (
        <Avatar key={tone} {...args} tone={tone} />
      ))}
    </div>
  ),
};

export const WithStatus: Story = {
  render: (args) => (
    <div className="flex items-center gap-3">
      <Avatar {...args} size="md" status="success" statusLabel="En línea" />
      <Avatar {...args} size="lg" status="warning" statusLabel="Ausente" />
      <Avatar {...args} size="lg" status="neutral" statusLabel="Desconectado" />
    </div>
  ),
};
