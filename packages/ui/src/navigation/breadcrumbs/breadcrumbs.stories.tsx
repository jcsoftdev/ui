import type { Meta, StoryObj } from "@storybook/react-vite";
import { Breadcrumbs } from "./breadcrumbs.js";

const meta = {
  title: "Navigation/Breadcrumbs",
  component: Breadcrumbs,
  tags: ["autodocs"],
  args: {
    items: [
      { label: "Home", href: "#home" },
      { label: "Customers", href: "#customers" },
      { label: "Marco Salazar" },
    ],
  },
  argTypes: { items: { control: false } },
} satisfies Meta<typeof Breadcrumbs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
