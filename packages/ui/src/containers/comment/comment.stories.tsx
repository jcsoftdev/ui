import type { Meta, StoryObj } from "@storybook/react-vite";
import { Comment } from "./comment.js";

const meta = {
  title: "Containers/Comment",
  component: Comment,
  tags: ["autodocs"],
  args: {
    tone: "pending",
    author: "Camila Rojas",
    label: "Nota de Camila Rojas",
    children: "El cliente pidió degradado alto y no usar navaja en la nuca.",
  },
  argTypes: {
    tone: { control: "inline-radio", options: ["pending", "reply"] },
    author: { control: "text" },
    label: { control: "text" },
    number: { control: "number" },
    children: { control: "text" },
  },
  decorators: [
    (Story) => (
      <div className="-mx-4 max-w-xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Comment>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Reply: Story = {
  args: {
    tone: "reply",
    author: "Diego Quispe",
    label: "Respuesta de Diego Quispe",
    children: "Anotado, lo atiendo yo el sábado a las 11:30.",
  },
};

export const Numbered: Story = { args: { number: 2 } };
