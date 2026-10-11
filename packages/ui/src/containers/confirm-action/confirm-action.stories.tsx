import type { Meta, StoryObj } from "@storybook/react-vite";
import { ConfirmAction, type ConfirmActionProps } from "./confirm-action.js";

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const succeed: ConfirmActionProps["onConfirm"] = async () => {
  await wait(800);
};

const meta = {
  title: "Containers/ConfirmAction",
  component: ConfirmAction,
  tags: ["autodocs"],
  args: {
    label: "Anular pedido",
    confirmLabel: "Sí, anular pedido",
    consequence: "El pedido de Marco Salazar se anula y su pago de S/ 45 se devuelve.",
    onConfirm: succeed,
  },
  argTypes: {
    triggerVariant: {
      control: "inline-radio",
      options: ["primary", "secondary", "ghost", "danger"],
    },
    onConfirm: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ConfirmAction>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ReturnsAnError: Story = {
  args: {
    onConfirm: async () => {
      await wait(500);
      return { ok: false, error: "El pago ya fue liquidado y no se puede devolver." };
    },
  },
};

export const Throws: Story = {
  args: {
    onConfirm: async () => {
      await wait(500);
      throw new Error("network");
    },
  },
};
