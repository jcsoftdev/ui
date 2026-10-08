import type { Meta, StoryObj } from "@storybook/react-vite";
import { Skeleton } from "./skeleton.js";

const meta = {
  title: "States/Skeleton",
  component: Skeleton,
  tags: ["autodocs"],
  args: { variant: "lines", lines: 3, rows: 4, label: "Cargando clientes" },
  argTypes: {
    variant: { control: "inline-radio", options: ["lines", "table", "card"] },
    lines: { control: { type: "number", min: 1, max: 12 } },
    rows: { control: { type: "number", min: 1, max: 12 } },
    label: { control: "text" },
  },
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Lines: Story = { args: { variant: "lines", lines: 5 } };

export const Table: Story = { args: { variant: "table", rows: 6, label: "Cargando citas" } };

export const Card: Story = { args: { variant: "card", label: "Cargando resumen" } };
