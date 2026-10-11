import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen, within } from "storybook/test";
import { Switch } from "../atoms/switch/switch.js";
import { Banner } from "../containers/banner/banner.js";
import { Field } from "../forms/field/field.js";
import { Input } from "../forms/input/index.js";
import { Dialog, DialogBody, DialogContent, DialogTitle } from "../overlays/dialog/dialog.js";

/**
 * Proves the `classNames` contract on representative multi-part components: each part's
 * classes land on the right DOM node, and on a conflicting utility they beat the kit's.
 */
const meta = {
  title: "Customization/classNames",
  tags: ["!autodocs"],
  parameters: { layout: "centered", controls: { disable: true } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const BannerParts: Story = {
  render: () => (
    <Banner
      tone="info"
      title="Heads up"
      classNames={{ root: "cx-root", title: "cx-title font-normal", body: "cx-body" }}
      className="cx-class-name"
    >
      Body text
    </Banner>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const title = canvas.getByText("Heads up");
    await expect(title).toHaveClass("cx-title", "font-normal");
    await expect(title).not.toHaveClass("font-semibold");
    await expect(title.parentElement).toHaveClass("cx-body");
    const root = title.parentElement?.parentElement;
    await expect(root).toHaveClass("cx-root", "cx-class-name");
  },
};

export const ClassNameBeatsRoot: Story = {
  render: () => (
    <Banner tone="info" title="Order" classNames={{ root: "p-2" }} className="p-6">
      Body
    </Banner>
  ),
  play: async ({ canvasElement }) => {
    const root = within(canvasElement).getByText("Order").parentElement?.parentElement;
    await expect(root).toHaveClass("p-6");
    await expect(root).not.toHaveClass("p-2");
  },
};

export const SwitchParts: Story = {
  render: () => (
    <Switch
      aria-label="Notify"
      classNames={{ track: "cx-track", thumb: "cx-thumb rounded-none" }}
    />
  ),
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("switch");
    const track = button.querySelector(".cx-track");
    const thumb = button.querySelector(".cx-thumb");
    await expect(track).not.toBeNull();
    await expect(thumb).not.toBeNull();
    await expect(thumb).toHaveClass("rounded-none");
    await expect(thumb).not.toHaveClass("rounded-pill");
  },
};

export const FieldParts: Story = {
  render: () => (
    <Field
      label="Client name"
      hint="Shown in the agenda"
      error="Required"
      classNames={{ root: "cx-root", label: "cx-label", error: "cx-error" }}
    >
      <Input />
    </Field>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Client name")).toHaveClass("cx-label");
    await expect(canvas.getByText("Required")).toHaveClass("cx-error");
    await expect(canvasElement.querySelector(".cx-root")).not.toBeNull();
  },
};

export const DialogParts: Story = {
  render: () => (
    <Dialog defaultOpen>
      <DialogContent
        closeLabel="Close"
        classNames={{ root: "cx-content", overlay: "cx-overlay bg-danger", close: "cx-close" }}
      >
        <DialogTitle>Portaled</DialogTitle>
        <DialogBody>Body</DialogBody>
      </DialogContent>
    </Dialog>
  ),
  play: async () => {
    const dialog = await screen.findByRole("dialog");
    await expect(dialog).toHaveClass("cx-content");
    const overlay = document.querySelector(".cx-overlay");
    await expect(overlay).not.toBeNull();
    await expect(overlay).toHaveClass("bg-danger");
    await expect(overlay).not.toHaveClass("bg-scrim");
    await expect(screen.getByRole("button", { name: "Close" })).toHaveClass("cx-close");
  },
};
