import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { AccentPicker } from "./accent-picker.js";

const options = [
  { value: "coral", label: "Coral", swatch: "#e0674d" },
  { value: "azul", label: "Azul", swatch: "#2f6fdb" },
  { value: "verde", label: "Verde", swatch: "#2e9b6a" },
  { value: "violeta", label: "Violeta", swatch: "#7a52d1" },
];

const meta = {
  title: "Forms/AccentPicker",
  component: AccentPicker,
  tags: ["autodocs"],
  args: { options, defaultValue: "coral", "aria-label": "Color de la barbería" },
  argTypes: {
    options: { control: "object" },
    value: { control: "text" },
    defaultValue: { control: "text" },
    disabled: { control: "boolean" },
    onValueChange: { control: false },
  },
} satisfies Meta<typeof AccentPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Disabled: Story = { args: { disabled: true } };

export const Controlled: Story = {
  render: (args) => {
    const [accent, setAccent] = useState("azul");
    return (
      <div className="flex flex-col gap-3">
        <AccentPicker {...args} defaultValue={undefined} value={accent} onValueChange={setAccent} />
        <p className="text-ink-3 text-meta">Acento activo: {accent}</p>
      </div>
    );
  },
};
