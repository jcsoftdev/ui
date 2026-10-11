import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { Avatar } from "./avatar/avatar.js";
import { Button } from "./button/button.js";
import { Checkbox } from "./checkbox/checkbox.js";
import { Progress } from "./progress/progress.js";
import { RadioGroup } from "./radio-group/radio-group.js";
import { Switch } from "./switch/switch.js";

const meta = {
  title: "Tests/Atoms",
  tags: ["!autodocs"],
  parameters: { layout: "centered" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const CheckboxToggles: Story = {
  render: () => <Checkbox aria-label="Cita completada" />,
  play: async ({ canvasElement }) => {
    const box = within(canvasElement).getByRole("checkbox", { name: "Cita completada" });
    await expect(box).toHaveAttribute("aria-checked", "false");
    await userEvent.click(box);
    await expect(box).toHaveAttribute("aria-checked", "true");
    await userEvent.click(box);
    await expect(box).toHaveAttribute("aria-checked", "false");
    box.focus();
    await userEvent.keyboard(" ");
    await expect(box).toHaveAttribute("aria-checked", "true");
    await expect(box).toHaveAttribute("data-state", "checked");
  },
};

export const SwitchToggles: Story = {
  render: () => <Switch aria-label="Recordatorios" />,
  play: async ({ canvasElement }) => {
    const toggle = within(canvasElement).getByRole("switch", { name: "Recordatorios" });
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    toggle.focus();
    await userEvent.keyboard(" ");
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await userEvent.keyboard("{Enter}");
    await expect(toggle).toHaveAttribute("aria-checked", "true");
  },
};

/** Radix selects on arrow focus from a frame callback, so the key must stay down for a frame. */
async function pressArrow(key: "ArrowDown" | "ArrowUp" | "ArrowLeft" | "ArrowRight") {
  await userEvent.keyboard(`{${key}>}`);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  await userEvent.keyboard(`{/${key}}`);
}

export const RadioGroupArrowKeys: Story = {
  render: () => (
    <>
      <button type="button">Antes</button>
      <RadioGroup
        aria-label="Método de pago"
        defaultValue="efectivo"
        options={[
          { value: "efectivo", label: "Efectivo" },
          { value: "yape", label: "Yape" },
          { value: "tarjeta", label: "Tarjeta" },
        ]}
      />
      <button type="button">Después</button>
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [efectivo, yape, tarjeta] = canvas.getAllByRole("radio");
    await expect(canvas.getByRole("radiogroup")).toBeInTheDocument();
    await waitFor(() => expect(efectivo).toHaveAttribute("aria-checked", "true"));
    canvas.getByRole("button", { name: "Antes" }).focus();
    await userEvent.tab();
    await expect(efectivo).toHaveFocus();
    await userEvent.tab();
    await expect(canvas.getByRole("button", { name: "Después" })).toHaveFocus();
    await userEvent.tab({ shift: true });
    await expect(efectivo).toHaveFocus();
    await pressArrow("ArrowDown");
    await expect(yape).toHaveFocus();
    await waitFor(() => expect(yape).toHaveAttribute("aria-checked", "true"));
    await pressArrow("ArrowRight");
    await waitFor(() => expect(tarjeta).toHaveAttribute("aria-checked", "true"));
    await pressArrow("ArrowDown");
    await waitFor(() => expect(efectivo).toHaveAttribute("aria-checked", "true"));
    await pressArrow("ArrowUp");
    await waitFor(() => expect(tarjeta).toHaveAttribute("aria-checked", "true"));
  },
};

export const ProgressAria: Story = {
  render: () => <Progress aria-label="Avance" value={40} max={80} />,
  play: async ({ canvasElement }) => {
    const bar = within(canvasElement).getByRole("progressbar", { name: "Avance" });
    await expect(bar).toHaveAttribute("aria-valuenow", "40");
    await expect(bar).toHaveAttribute("aria-valuemax", "80");
    await expect(bar).toHaveAttribute("aria-valuemin", "0");
    await expect(bar).toHaveAttribute("aria-valuetext", "50%");
    await expect(bar).toHaveAttribute("data-state", "loading");
    await expect(bar).toHaveAttribute("data-value", "40");
    await expect(bar).toHaveAttribute("data-max", "80");
  },
};

export const ProgressComplete: Story = {
  render: () => <Progress aria-label="Listo" value={100} />,
  play: async ({ canvasElement }) => {
    const bar = within(canvasElement).getByRole("progressbar", { name: "Listo" });
    await expect(bar).toHaveAttribute("data-state", "complete");
  },
};

export const AvatarFallbackOnBrokenImage: Story = {
  render: () => <Avatar name="Marco Ríos" src="/missing-avatar.png" />,
  play: async ({ canvasElement }) => {
    const avatar = within(canvasElement).getByRole("img", { name: "Marco Ríos" });
    await waitFor(() => expect(avatar).toHaveTextContent("MR"), { timeout: 3000 });
  },
};

export const AvatarFallbackWithoutImage: Story = {
  render: () => <Avatar name="Diego" />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("img", { name: "Diego" })).toHaveTextContent("DI");
  },
};

const onLinkClick = fn((event: { preventDefault: () => void }) => event.preventDefault());

export const ButtonAsChild: Story = {
  render: () => (
    <Button asChild className="custom-class" onClick={onLinkClick}>
      <a href="#destino">Ir al destino</a>
    </Button>
  ),
  play: async ({ canvasElement }) => {
    onLinkClick.mockClear();
    const link = within(canvasElement).getByRole("link", { name: "Ir al destino" });
    await expect(link.tagName).toBe("A");
    await expect(link).toHaveAttribute("href", "#destino");
    await expect(link).toHaveClass("custom-class");
    await expect(within(canvasElement).queryByRole("button")).toBeNull();
    await userEvent.click(link);
    await expect(onLinkClick).toHaveBeenCalledTimes(1);
  },
};
