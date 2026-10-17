import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import { Button } from "../../atoms/button/button.js";
import { UiStringsProvider } from "../../i18n/index.js";
import { AlertDialog, type AlertDialogProps } from "./alert-dialog.js";

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const meta = {
  title: "Overlays/AlertDialog",
  component: AlertDialog,
  tags: ["autodocs"],
  args: {
    trigger: <Button variant="danger">Delete appointment</Button>,
    title: "Delete this appointment?",
    description: "Marco Salazar will be notified and the slot becomes free.",
    confirmLabel: "Delete",
    tone: "danger",
    onConfirm: (async () => {
      await wait(300);
    }) as AlertDialogProps["onConfirm"],
  },
  argTypes: {
    tone: { control: "inline-radio", options: ["default", "danger"] },
    initialFocus: { control: "inline-radio", options: ["cancel", "confirm"] },
    trigger: { control: false },
    onConfirm: { control: false },
  },
} satisfies Meta<typeof AlertDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

const dialog = () => screen.findByRole("alertdialog", { name: "Delete this appointment?" });

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Delete appointment" }),
    );
    const panel = await dialog();
    await expect(panel).toHaveAccessibleDescription(/Marco Salazar will be notified/);
    await waitFor(() =>
      expect(within(panel).getByRole("button", { name: "Cancel" })).toHaveFocus(),
    );
  },
};

export const EscapeCancels: Story = {
  args: { onCancel: fn() },
  play: async ({ canvasElement, args }) => {
    const trigger = within(canvasElement).getByRole("button", { name: "Delete appointment" });
    await userEvent.click(trigger);
    await dialog();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    await expect(args.onCancel).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};

export const OutsidePressDoesNothing: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Delete appointment" }),
    );
    await dialog();
    await userEvent.click(document.querySelector(".bg-scrim") as HTMLElement);
    await expect(screen.getByRole("alertdialog")).toBeVisible();
  },
};

export const ConfirmRunsOnceAndCloses: Story = {
  args: { onConfirm: fn(async () => wait(200)) },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Delete appointment" }),
    );
    const panel = await dialog();
    const confirm = within(panel).getByRole("button", { name: "Delete" });
    await userEvent.click(confirm);
    await userEvent.click(confirm);
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    await expect(args.onConfirm).toHaveBeenCalledTimes(1);
  },
};

export const PendingBlocksEveryWayOut: Story = {
  args: { onConfirm: async () => wait(600), onCancel: fn() },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Delete appointment" }),
    );
    const panel = await dialog();
    await userEvent.click(within(panel).getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(within(panel).getByRole("button", { name: "Cancel" })).toBeDisabled(),
    );
    await expect(panel).toContainElement(document.activeElement as HTMLElement);
    await userEvent.keyboard("{Escape}");
    await expect(screen.getByRole("alertdialog")).toBeVisible();
    await expect(args.onCancel).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  },
};

export const ReturnedFailureKeepsItOpen: Story = {
  args: {
    onConfirm: (async () => ({
      ok: false,
      error: "The slot was already released.",
    })) as AlertDialogProps["onConfirm"],
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Delete appointment" }),
    );
    const panel = await dialog();
    await userEvent.click(within(panel).getByRole("button", { name: "Delete" }));
    await expect(await within(panel).findByRole("alert")).toHaveTextContent("already released");
    await expect(within(panel).getByRole("button", { name: "Delete" })).toBeEnabled();
    await expect(within(panel).getByRole("button", { name: "Cancel" })).toHaveFocus();
  },
};

export const ThrownFailureShowsGenericMessage: Story = {
  args: {
    onConfirm: async () => {
      throw new Error("network");
    },
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Delete appointment" }),
    );
    const panel = await dialog();
    await userEvent.click(within(panel).getByRole("button", { name: "Delete" }));
    await expect(await within(panel).findByRole("alert")).toHaveTextContent(
      "The action could not be completed. Try again.",
    );
  },
};

export const FocusOnConfirm: Story = {
  args: { initialFocus: "confirm", tone: "default", confirmLabel: "Publish" },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Delete appointment" }),
    );
    const panel = await dialog();
    await waitFor(() =>
      expect(within(panel).getByRole("button", { name: "Publish" })).toHaveFocus(),
    );
  },
};

export const Controlled: Story = {
  args: { trigger: undefined },
  render: (args) => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button variant="danger" onClick={() => setOpen(true)}>
          Delete appointment
        </Button>
        <AlertDialog {...args} open={open} onOpenChange={setOpen} />
      </>
    );
  },
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", { name: "Delete appointment" });
    await userEvent.click(trigger);
    await dialog();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};

export const InSpanish: Story = {
  args: { confirmLabel: undefined },
  render: (args) => (
    <UiStringsProvider locale="es">
      <AlertDialog {...args} title="¿Anular esta cita?" description="El horario quedará libre." />
    </UiStringsProvider>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Delete appointment" }),
    );
    const panel = await screen.findByRole("alertdialog", { name: "¿Anular esta cita?" });
    await expect(within(panel).getByRole("button", { name: "Cancelar" })).toBeVisible();
    await expect(within(panel).getByRole("button", { name: "Confirmar" })).toBeVisible();
  },
};

export const ConfirmDisabled: Story = {
  args: { confirmDisabled: true, cancelDisabled: false },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Delete appointment" }),
    );
    const panel = await dialog();
    await expect(within(panel).getByRole("button", { name: "Delete" })).toBeDisabled();
    await expect(within(panel).getByRole("button", { name: "Cancel" })).toBeEnabled();
  },
};

export const CancelDisabled: Story = {
  args: { cancelDisabled: true },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Delete appointment" }),
    );
    const panel = await dialog();
    await expect(within(panel).getByRole("button", { name: "Cancel" })).toBeDisabled();
    await expect(within(panel).getByRole("button", { name: "Delete" })).toBeEnabled();
  },
};

function ComposedExample({ onRemove }: { onRemove: (event: { preventDefault(): void }) => void }) {
  const [reason, setReason] = useState("");
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>
        <Button variant="danger">Remove student</Button>
      </AlertDialog.Trigger>
      <AlertDialog.Content>
        <AlertDialog.Header>
          <AlertDialog.Title>Remove this student?</AlertDialog.Title>
          <AlertDialog.Description>Their grades are archived.</AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Body>
          <input
            aria-label="Reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </AlertDialog.Body>
        <AlertDialog.Footer>
          <AlertDialog.Cancel />
          <AlertDialog.Action tone="danger" disabled={reason === ""} onClick={onRemove}>
            Remove
          </AlertDialog.Action>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}

export const Composed: StoryObj = {
  render: () => <ComposedExample onRemove={() => {}} />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Remove student" }));
    const panel = await screen.findByRole("alertdialog", { name: "Remove this student?" });
    await expect(panel).toHaveAccessibleDescription("Their grades are archived.");
    await waitFor(() =>
      expect(within(panel).getByRole("button", { name: "Cancel" })).toHaveFocus(),
    );
    const action = within(panel).getByRole("button", { name: "Remove" });
    await expect(action).toBeDisabled();
    await userEvent.type(within(panel).getByRole("textbox", { name: "Reason" }), "left");
    await expect(action).toBeEnabled();
    await userEvent.click(action);
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  },
};

export const ComposedEscapeAndOutside: StoryObj = {
  render: () => <ComposedExample onRemove={() => {}} />,
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", { name: "Remove student" });
    await userEvent.click(trigger);
    await screen.findByRole("alertdialog");
    await userEvent.click(document.body);
    await expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};

export const ComposedActionCanKeepItOpen: StoryObj = {
  render: () => (
    <ComposedExample
      onRemove={(event) => {
        event.preventDefault();
      }}
    />
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Remove student" }));
    const panel = await screen.findByRole("alertdialog");
    await userEvent.type(within(panel).getByRole("textbox", { name: "Reason" }), "x");
    await userEvent.click(within(panel).getByRole("button", { name: "Remove" }));
    await expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  },
};
