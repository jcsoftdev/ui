import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../../atoms/button/button.js";
import { Stack } from "./stack.js";

const meta = {
  title: "Containers/Stack",
  component: Stack,
  tags: ["autodocs"],
  args: {
    children: (
      <>
        <Button>Save</Button>
        <Button variant="secondary">Cancel</Button>
        <Button variant="ghost">Discard</Button>
      </>
    ),
  },
  argTypes: {
    direction: { control: "inline-radio", options: ["column", "row"] },
    gap: { control: "select", options: ["none", "xs", "sm", "md", "lg", "xl"] },
    align: {
      control: "select",
      options: [undefined, "start", "center", "end", "stretch", "baseline"],
    },
    children: { control: false },
  },
} satisfies Meta<typeof Stack>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Column: Story = {};

export const Row: Story = { args: { direction: "row", gap: "sm" } };
