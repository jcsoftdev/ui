import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { UiStringsProvider } from "../../i18n/index.js";
import { Spinner } from "./spinner.js";

const meta = {
  title: "Atoms/Spinner",
  component: Spinner,
  tags: ["autodocs"],
  args: { size: "sm" },
  argTypes: {
    size: { control: "inline-radio", options: ["xs", "sm", "md", "lg"] },
    label: { control: "text" },
  },
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status", { name: "Loading" })).toBeVisible();
  },
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex items-center gap-4 text-ink-2">
      <Spinner {...args} size="xs" />
      <Spinner {...args} size="sm" />
      <Spinner {...args} size="md" />
      <Spinner {...args} size="lg" />
      <Spinner {...args} size={40} />
    </div>
  ),
};

export const CustomLabel: Story = { args: { label: "Saving appointment" } };

export const Decorative: Story = {
  args: { label: false },
  render: (args) => (
    <span className="inline-flex items-center gap-2 text-body text-ink">
      <Spinner {...args} />
      Saving…
    </span>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("status")).toBeNull();
  },
};

export const Spanish: Story = {
  render: (args) => (
    <UiStringsProvider locale="es">
      <Spinner {...args} />
    </UiStringsProvider>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status", { name: "Cargando" })).toBeVisible();
  },
};
