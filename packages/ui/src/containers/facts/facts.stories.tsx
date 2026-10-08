import type { Meta, StoryObj } from "@storybook/react-vite";
import { Facts } from "./facts.js";

const meta = {
  title: "Containers/Facts",
  component: Facts,
  tags: ["autodocs"],
  args: {
    children: (
      <>
        <div>
          <dt>Visitas</dt>
          <dd>14 este año</dd>
        </div>
        <div>
          <dt>Barbero habitual</dt>
          <dd>Diego Quispe</dd>
        </div>
        <div>
          <dt>Gasto total</dt>
          <dd>S/ 560</dd>
        </div>
      </>
    ),
  },
  argTypes: { children: { control: false } },
} satisfies Meta<typeof Facts>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="max-w-[420px]">
        <Story />
      </div>
    ),
  ],
};
