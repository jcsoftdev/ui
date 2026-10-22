import type { Meta, StoryObj } from "@storybook/react-vite";
import { type FormEvent, useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { Scissors } from "../../icons/index.js";
import { Button } from "./button.js";

const meta = {
  title: "Atoms/Button",
  component: Button,
  tags: ["autodocs"],
  args: { children: "Reservar corte", variant: "primary", size: "md" },
  argTypes: {
    variant: { control: "inline-radio", options: ["primary", "secondary", "ghost", "danger"] },
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
    loading: { control: "boolean" },
    loadingLabel: { control: "text" },
    block: { control: "boolean" },
    disabled: { control: "boolean" },
    asChild: { control: false },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Secondary: Story = { args: { variant: "secondary", children: "Ver agenda" } };

export const Ghost: Story = { args: { variant: "ghost", children: "Cancelar" } };

export const Danger: Story = { args: { variant: "danger", children: "Anular cita" } };

export const Small: Story = { args: { size: "sm", children: "Cobrar S/ 35" } };

export const Loading: Story = {
  args: { loading: true, children: "Guardando cliente", onClick: fn() },
  play: async ({ canvasElement, args }) => {
    const button = within(canvasElement).getByRole("button", { name: "Guardando cliente" });
    await expect(button).toHaveAttribute("aria-busy", "true");
    await expect(button).toHaveAttribute("aria-disabled", "true");
    await expect(button).not.toBeDisabled();
    await expect(getComputedStyle(button).opacity).toBe("1");
    await expect(getComputedStyle(button).cursor).toBe("progress");
    await userEvent.click(button);
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};

export const Large: Story = { args: { size: "lg", children: "Cobrar S/ 35" } };

export const Block: Story = {
  args: { block: true, size: "lg", children: "Confirmar reserva" },
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
};

export const LoadingWithLabel: Story = {
  args: { loading: true, loadingLabel: "Guardando…", children: "Guardar cliente" },
};

export const Disabled: Story = { args: { disabled: true, children: "Cobrar" } };

/** Disabled wins over loading: the button leaves the tab order and dims, as a disabled one does. */
export const DisabledWhileLoading: Story = {
  args: { disabled: true, loading: true, children: "Cobrar" },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: "Cobrar" });
    await expect(button).toBeDisabled();
    await expect(button).not.toHaveAttribute("aria-disabled");
  },
};

function SubmitWhileBusy({ onSubmit }: { onSubmit: () => void }) {
  const [loading, setLoading] = useState(false);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
    setLoading(true);
    setTimeout(() => setLoading(false), 1500);
  };
  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <input
        aria-label="Cliente"
        defaultValue="Diego"
        className="h-control rounded-input border border-line px-2"
      />
      <Button type="submit" variant="primary" loading={loading} loadingLabel="Guardando…">
        Guardar
      </Button>
    </form>
  );
}

/**
 * A keyboard press on a submit button keeps focus on it while it is busy, and neither another press
 * nor Enter in a field of the form submits again until the work ends.
 */
export const LoadingKeepsFocusAndBlocksResubmit: StoryObj<typeof SubmitWhileBusy> = {
  args: { onSubmit: fn() },
  render: (args) => <SubmitWhileBusy {...args} />,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "Guardar" });
    button.focus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onSubmit).toHaveBeenCalledTimes(1);
    await expect(button).toHaveAttribute("aria-busy", "true");
    await expect(button).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    await userEvent.click(button);
    await userEvent.type(canvas.getByRole("textbox", { name: "Cliente" }), "{Enter}");
    await expect(args.onSubmit).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(button).not.toHaveAttribute("aria-busy"), { timeout: 3000 });
    await userEvent.click(button);
    await expect(args.onSubmit).toHaveBeenCalledTimes(2);
  },
};

export const WithIcon: Story = {
  args: {
    children: (
      <>
        <Scissors aria-hidden /> Corte clásico - S/ 25
      </>
    ),
  },
};

export const AsLink: Story = {
  args: {
    asChild: true,
    variant: "secondary",
    children: <a href="#barberos">Ver barberos</a>,
  },
};

/** A long label in a narrow container ends in "…" instead of overflowing; the icon keeps its size. */
export const LongLabel: Story = {
  args: {
    variant: "primary",
    children: (
      <>
        <Scissors aria-hidden /> Confirmar la reserva de corte y barba con Diego
      </>
    ),
  },
  decorators: [
    (Story) => (
      <div style={{ width: 200 }}>
        <Story />
      </div>
    ),
  ],
};
