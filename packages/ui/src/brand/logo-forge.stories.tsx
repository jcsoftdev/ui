import type { Meta, StoryObj } from "@storybook/react-vite";
import { LogoForge } from "./logo-forge.js";

const meta = {
  title: "Foundations/LogoForge",
  component: LogoForge,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  argTypes: {
    defaultValue: { control: "object" },
    onChange: { control: false },
    className: { control: false },
  },
} satisfies Meta<typeof LogoForge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { parameters: { a11y: { test: "todo" } } };

export const Narrow: Story = {
  parameters: { a11y: { test: "todo" } },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};

export const BrutalPreset: Story = {
  parameters: { a11y: { test: "todo" } },
  decorators: [
    (Story) => (
      <div data-style="brutal">
        <Story />
      </div>
    ),
  ],
};

export const BarberiaDonLucho: Story = {
  parameters: { a11y: { test: "todo" } },
  name: "Barbería Don Lucho",
  args: {
    defaultValue: {
      name: "Barbería Don Lucho",
      tagline: "Corte clásico y afeitado a navaja",
      shape: "badge",
      monogram: "initials",
      initialsCount: 2,
      layout: "stacked",
      fill: "gradient",
      paletteId: "bronce",
      weight: 800,
      tracking: 0.12,
    },
  },
};
