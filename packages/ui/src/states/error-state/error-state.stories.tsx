import type { Meta, StoryObj } from "@storybook/react-vite";
import { ErrorState } from "./error-state.js";

const meta = {
  title: "States/ErrorState",
  component: ErrorState,
  tags: ["autodocs"],
  args: {
    message: "No pudimos cargar la agenda del día",
    correlationId: "7f3a-91c2",
    correlationLabel: "ID:",
    retryLabel: "Reintentar",
    onRetry: () => {},
  },
  argTypes: {
    message: { control: "text" },
    correlationId: { control: "text" },
    correlationLabel: { control: "text" },
    retryLabel: { control: "text" },
    onRetry: { action: "retry" },
  },
} satisfies Meta<typeof ErrorState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutRetry: Story = { args: { onRetry: undefined } };

export const WithoutCorrelation: Story = { args: { correlationId: undefined } };

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="@container w-80 max-w-full">
        <Story />
      </div>
    ),
  ],
};
