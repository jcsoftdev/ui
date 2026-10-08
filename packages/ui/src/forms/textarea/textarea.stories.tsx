import type { Meta, StoryObj } from "@storybook/react-vite";
import { Textarea } from "./textarea.js";

const meta = {
  title: "Forms/Textarea",
  component: Textarea,
  tags: ["autodocs"],
  args: {
    placeholder: "Notas del corte: degradado bajo, barba perfilada...",
    "aria-label": "Notas",
  },
  argTypes: {
    placeholder: { control: "text" },
    rows: { control: "number" },
    disabled: { control: "boolean" },
    readOnly: { control: "boolean" },
    "aria-invalid": { control: "boolean" },
  },
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithValue: Story = {
  args: { defaultValue: "Prefiere degradado bajo y poca cera. Alérgico a la pomada con mentol." },
};

export const Invalid: Story = { args: { defaultValue: "ok", "aria-invalid": true } };

export const Disabled: Story = { args: { disabled: true, defaultValue: "Cita cancelada" } };
