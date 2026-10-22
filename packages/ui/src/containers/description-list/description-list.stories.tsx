import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { DescriptionList, DescriptionListItem } from "./description-list.js";

const meta = {
  title: "Containers/DescriptionList",
  component: DescriptionList,
  tags: ["autodocs"],
  args: {
    children: (
      <>
        <dt>Cliente</dt>
        <dd>Luis Ramírez</dd>
        <dt>Servicio</dt>
        <dd>Corte + barba</dd>
        <dt>Barbero</dt>
        <dd>Mateo Flores</dd>
        <dt>Hora</dt>
        <dd>Sábado 11:30</dd>
        <dt>Total</dt>
        <dd>S/ 45</dd>
      </>
    ),
  },
  argTypes: { children: { control: false } },
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DescriptionList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongValues: Story = {
  args: {
    children: (
      <>
        <dt>Notas</dt>
        <dd>Degradado alto, tijera arriba, perfilado de barba con navaja y cera mate</dd>
        <dt>Producto</dt>
        <dd>Pomada mate Hombre Fuerte 100 g</dd>
      </>
    ),
  },
};

/** 320 px container: use it to check the narrow layout without resizing the viewport. */
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="@container/page w-[320px] max-w-full">
        <Story />
      </div>
    ),
  ],
};

const colsOf = (el: Element) => getComputedStyle(el).gridTemplateColumns.split(" ").length;

export const ItemsWithPlaceholder: Story = {
  render: () => (
    <DescriptionList valueAlign="start" aria-label="Student">
      <DescriptionListItem term="Name">Luis Ramírez</DescriptionListItem>
      <DescriptionListItem term="Phone" emptyLabel="Not provided" />
      <DescriptionListItem term="Email" placeholder="n/a">
        {""}
      </DescriptionListItem>
    </DescriptionList>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const dl = canvasElement.querySelector("dl") as HTMLElement;
    const dds = Array.from(dl.querySelectorAll("dd"));
    await expect(dds.map((dd) => dd.hasAttribute("data-empty"))).toEqual([false, true, true]);
    await expect(dds[1]).toHaveTextContent("—");
    await expect(canvas.getByText("Not provided")).toHaveClass("sr-only");
    await expect(dds[2]).toHaveTextContent("n/a");
    await expect(getComputedStyle(dds[0] as Element).textAlign).toBe("start");
  },
};

export const InlineNeverStacks: Story = {
  args: { layout: "inline" },
  decorators: [
    (Story) => (
      <div className="w-56">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    await expect(colsOf(canvasElement.querySelector("dl") as Element)).toBe(2);
  },
};

export const AutoStacksWhenNarrow: Story = {
  decorators: [
    (Story) => (
      <div className="w-56">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    await expect(colsOf(canvasElement.querySelector("dl") as Element)).toBe(1);
  },
};

export const StackedAlways: Story = {
  args: { layout: "stacked" },
  decorators: [
    (Story) => (
      <div className="w-[40rem]">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    await expect(colsOf(canvasElement.querySelector("dl") as Element)).toBe(1);
  },
};

export const TwoColumns: Story = {
  args: { columns: 2 },
  decorators: [
    (Story) => (
      <div className="w-[40rem]">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    await expect(colsOf(canvasElement.querySelector("dl") as Element)).toBe(4);
  },
};

export const TwoColumnsCollapseWhenNarrow: Story = {
  args: { columns: 2 },
  decorators: [
    (Story) => (
      <div className="w-64">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    await expect(colsOf(canvasElement.querySelector("dl") as Element)).toBe(1);
  },
};
