import type { Meta, StoryObj } from "@storybook/react-vite";
import { DescriptionList } from "./description-list.js";

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
