import type { Meta, StoryObj } from "@storybook/react-vite";
import { Avatar } from "../avatar/index.js";
import { AvatarGroup } from "./avatar-group.js";

const meta = {
  title: "Atoms/AvatarGroup",
  component: AvatarGroup,
  tags: ["autodocs"],
  argTypes: { children: { control: false }, className: { control: "text" } },
  args: {
    children: (
      <>
        <Avatar name="Diego Quispe" />
        <Avatar name="Marco Ríos" />
        <Avatar name="Lucho Vargas" />
      </>
    ),
  },
} satisfies Meta<typeof AvatarGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Large: Story = {
  args: {
    children: (
      <>
        <Avatar name="Diego Quispe" size="lg" highlighted />
        <Avatar name="Marco Ríos" size="lg" />
        <Avatar name="Lucho Vargas" size="lg" />
        <Avatar name="Andrés Paredes" size="lg" />
      </>
    ),
  },
};

export const Single: Story = { args: { children: <Avatar name="Diego Quispe" /> } };
