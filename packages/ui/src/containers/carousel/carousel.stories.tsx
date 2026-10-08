import type { Meta, StoryObj } from "@storybook/react-vite";
import { Carousel } from "./carousel.js";

const servicios = [
  { nombre: "Corte clásico", precio: "S/ 35", detalle: "Tijera y máquina, 30 min" },
  { nombre: "Perfilado de barba", precio: "S/ 25", detalle: "Con toalla caliente, 20 min" },
  { nombre: "Corte + barba", precio: "S/ 55", detalle: "El combo más pedido, 50 min" },
  { nombre: "Degradado", precio: "S/ 40", detalle: "Fade alto, medio o bajo, 35 min" },
  { nombre: "Corte infantil", precio: "S/ 25", detalle: "Hasta 10 años, 25 min" },
  { nombre: "Tinte de barba", precio: "S/ 45", detalle: "Cubre canas, 40 min" },
];

function slides() {
  return servicios.map((s) => (
    <article
      key={s.nombre}
      className="flex h-36 flex-col justify-between rounded-card border-card surface-card p-card shadow-card"
    >
      <div>
        <h3 className="m-0 text-card-title text-ink">{s.nombre}</h3>
        <p className="m-0 text-ink-3 text-meta">{s.detalle}</p>
      </div>
      <span className="text-kpi-number text-ink">{s.precio}</span>
    </article>
  ));
}

const meta = {
  title: "Containers/Carousel",
  component: Carousel,
  tags: ["autodocs"],
  args: {
    label: "Servicios destacados",
    loop: false,
    autoplay: false,
    showDots: true,
    showArrows: true,
    children: slides(),
  },
  argTypes: {
    label: { control: "text" },
    loop: { control: "boolean" },
    autoplay: { control: "boolean" },
    showDots: { control: "boolean" },
    showArrows: { control: "boolean" },
    slideClassName: { control: "text" },
    children: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-3xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Carousel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Opt-in. Pauses on hover and focus, has a pause button, and is off under reduced motion. */
export const Autoplay: Story = { args: { autoplay: 4000, loop: true } };

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="w-[320px] max-w-full">
        <Story />
      </div>
    ),
  ],
};

export const BrutalPreset: Story = {
  decorators: [
    (Story) => (
      <div data-style="brutal" className="bg-bg p-card">
        <Story />
      </div>
    ),
  ],
};

export const GlassPreset: Story = {
  decorators: [
    (Story) => (
      <div data-style="glass" className="bg-bg p-card">
        <Story />
      </div>
    ),
  ],
};
