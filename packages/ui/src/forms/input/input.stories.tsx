import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Input } from "./input.js";

const meta = {
  title: "Forms/Input",
  component: Input,
  tags: ["autodocs"],
  args: { placeholder: "Ej. Marco Salazar", "aria-label": "Nombre del cliente" },
  argTypes: {
    type: { control: "inline-radio", options: ["text", "email", "tel", "number", "password"] },
    placeholder: { control: "text" },
    disabled: { control: "boolean" },
    readOnly: { control: "boolean" },
    "aria-invalid": { control: "boolean" },
  },
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithValue: Story = { args: { defaultValue: "Marco Salazar" } };

export const Telephone: Story = {
  args: { type: "tel", placeholder: "987 654 321", "aria-label": "Teléfono" },
};

export const Invalid: Story = { args: { defaultValue: "marco@", "aria-invalid": true } };

export const Disabled: Story = { args: { disabled: true, defaultValue: "Diego Quispe" } };

export const ReadOnly: Story = { args: { readOnly: true, defaultValue: "S/ 35.00" } };

export const ExtraSmall: Story = {
  args: { size: "xs", "aria-label": "Filtro" },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("textbox", { name: "Filtro" });
    await expect(input.getBoundingClientRect().height).toBe(30);
  },
};

export const Adornments: Story = {
  args: { start: "S/", end: "PEN", defaultValue: "35.00", "aria-label": "Precio" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox", { name: "Precio" });
    const box = input.parentElement as HTMLElement;
    // The wrapper draws the field; the input itself is chrome-free.
    await expect(getComputedStyle(box).borderTopWidth).not.toBe("0px");
    await expect(getComputedStyle(input).borderTopWidth).toBe("0px");
    await expect(canvas.getByText("S/")).toBeVisible();
    await expect(canvas.getByText("PEN")).toBeVisible();
    await expect(box.getBoundingClientRect().height).toBe(38);
  },
};

export const AdornmentInvalid: Story = {
  args: { start: "S/", "aria-invalid": true, "aria-label": "Monto" },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("textbox", { name: "Monto" });
    const danger = getComputedStyle(document.documentElement).getPropertyValue("--danger").trim();
    await expect(danger).not.toBe("");
    await expect(getComputedStyle(input.parentElement as HTMLElement).borderTopColor).not.toBe(
      getComputedStyle(document.body).borderTopColor,
    );
  },
};

export const Bare: Story = {
  args: { variant: "bare", defaultValue: "Sin marco", "aria-label": "Título" },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("textbox", { name: "Título" });
    const style = getComputedStyle(input);
    await expect(style.borderTopWidth).toBe("0px");
    await expect(style.paddingLeft).toBe("0px");
    await expect(style.backgroundColor).toBe("rgba(0, 0, 0, 0)");
  },
};
