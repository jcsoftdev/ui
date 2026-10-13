import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card, CardBody } from "../card/card.js";
import { Grid } from "./grid.js";

const cells = Array.from({ length: 6 }, (_, index) => (
  // biome-ignore lint/suspicious/noArrayIndexKey: static demo cells
  <Card key={index}>
    <CardBody>Cell {index + 1}</CardBody>
  </Card>
));

const meta = {
  title: "Containers/Grid",
  component: Grid,
  tags: ["autodocs"],
  args: { children: cells },
  argTypes: {
    columns: { control: "number" },
    minColumnWidth: { control: "text" },
    gap: { control: "select", options: ["none", "xs", "sm", "md", "lg", "xl"] },
    children: { control: false },
  },
} satisfies Meta<typeof Grid>;

export default meta;
type Story = StoryObj<typeof meta>;

/** No `columns`: the column count follows the available width. */
export const Intrinsic: Story = {};

export const FixedColumns: Story = { args: { columns: 3 } };
