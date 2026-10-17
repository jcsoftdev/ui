import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
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
    title: { control: "text" },
    description: { control: "text" },
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

export const TitleAndDescription: Story = {
  args: {
    message: undefined,
    title: "No pudimos cargar la agenda",
    description: "Tus citas están a salvo. Revisa tu conexión e inténtalo de nuevo.",
  },
};

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

export const Outlined: Story = { args: { variant: "outlined" } };

export const WithActions: Story = {
  args: {
    onRetry: fn(),
    actions: (
      <>
        <a
          href="#home"
          className="inline-flex h-control-sm items-center rounded-input px-3 font-semibold text-accent-ink text-fs-130"
        >
          Volver al inicio
        </a>
        <a
          href="#support"
          className="inline-flex h-control-sm items-center rounded-input px-3 font-semibold text-accent-ink text-fs-130"
        >
          Contactar a soporte
        </a>
      </>
    ),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("link", { name: "Volver al inicio" })).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Contactar a soporte" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: /reintentar|retry/i }));
    await expect(args.onRetry).toHaveBeenCalledTimes(1);
  },
};

export const ActionsWithoutRetry: Story = {
  args: { onRetry: undefined, actions: <a href="#home">Volver al inicio</a> },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("link", { name: "Volver al inicio" })).toBeVisible();
    await expect(canvas.queryByRole("button")).toBeNull();
  },
};
