import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Skeleton } from "./skeleton.js";

const meta = {
  title: "States/Skeleton",
  component: Skeleton,
  tags: ["autodocs"],
  args: { variant: "lines", lines: 3, rows: 4, label: "Cargando clientes" },
  argTypes: {
    variant: {
      control: "inline-radio",
      options: ["lines", "table", "card", "list", "kpis", "key-value", "bar"],
    },
    lines: { control: { type: "number", min: 1, max: 12 } },
    rows: { control: { type: "number", min: 1, max: 12 } },
    count: { control: { type: "number", min: 1, max: 12 } },
    label: { control: "text" },
  },
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Lines: Story = { args: { variant: "lines", lines: 5 } };

export const Table: Story = { args: { variant: "table", rows: 6, label: "Cargando citas" } };

export const Card: Story = { args: { variant: "card", label: "Cargando resumen" } };

const flush = async (canvasElement: HTMLElement) => {
  const status = within(canvasElement).getByRole("status");
  await expect(status).toHaveAttribute("aria-busy", "true");
  for (const node of [status, ...status.querySelectorAll<HTMLElement>("*")]) {
    if (node.parentElement === status || node === status) {
      const style = getComputedStyle(node);
      await expect(style.paddingInlineStart).toBe("0px");
      await expect(style.paddingInlineEnd).toBe("0px");
    }
  }
  return status;
};

export const List: Story = {
  args: { variant: "list", count: 4, label: "Cargando alumnos" },
  play: async ({ canvasElement }) => {
    const status = await flush(canvasElement);
    await expect(status.querySelectorAll("[aria-hidden]").length).toBeGreaterThanOrEqual(12);
  },
};

export const Kpis: Story = {
  args: { variant: "kpis", count: 4, label: "Cargando indicadores" },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    await flush(canvasElement);
  },
};

export const KeyValue: Story = {
  args: { variant: "key-value", count: 5, label: "Cargando ficha" },
  play: async ({ canvasElement }) => {
    const status = await flush(canvasElement);
    await expect(status.querySelectorAll("[aria-hidden]")).toHaveLength(10);
  },
};

export const Bar: Story = {
  args: { variant: "bar", className: "h-8 w-32", label: "Cargando nombre" },
  play: async ({ canvasElement }) => {
    const bar = within(canvasElement).getByRole("status", { name: "Cargando nombre" });
    const box = bar.getBoundingClientRect();
    await expect(Math.round(box.height)).toBe(32);
    await expect(Math.round(box.width)).toBe(128);
  },
};
