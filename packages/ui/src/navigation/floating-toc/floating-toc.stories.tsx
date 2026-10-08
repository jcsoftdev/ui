import type { Meta, StoryObj } from "@storybook/react-vite";
import { useRef } from "react";
import { FloatingToc } from "./floating-toc.js";
import type { TocItem } from "./model.js";

const items: TocItem[] = [
  { id: "servicios", label: "Servicios y precios" },
  { id: "cortes", label: "Cortes", level: 2 },
  { id: "barba", label: "Barba y afeitado", level: 2 },
  { id: "horarios", label: "Horarios de atención" },
  { id: "reservas", label: "Cómo reservar" },
  { id: "pagos", label: "Pagos con Yape y tarjeta" },
];

const meta = {
  title: "Navigation/FloatingToc",
  component: FloatingToc,
  tags: ["autodocs"],
  args: { items, title: "En esta página" },
  argTypes: {
    title: { control: "text" },
    items: { control: false },
    scrollRoot: { control: false },
    onActiveChange: { control: false },
    offsetTop: { control: "number" },
  },
} satisfies Meta<typeof FloatingToc>;

export default meta;
type Story = StoryObj<typeof meta>;

function Article({ narrow }: { narrow?: boolean }) {
  const scroller = useRef<HTMLDivElement>(null);
  return (
    <div
      className={
        narrow
          ? "flex w-[320px] max-w-full flex-col gap-density"
          : "grid w-full max-w-3xl grid-cols-[12rem_1fr] gap-density-lg"
      }
    >
      <div className="self-start">
        <FloatingToc items={items} scrollRoot={scroller} />
      </div>
      <section
        ref={scroller}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: scrollable region must be keyboard reachable
        tabIndex={0}
        aria-label="Guía de la barbería"
        className="h-72 overflow-y-auto rounded-card border-card surface-card p-card shadow-card focus-visible:focus-ring"
      >
        {items.map((item) => (
          <section key={item.id} className="pb-density-lg">
            <h3 id={item.id} className="m-0 pb-density-sm text-card-title text-ink">
              {item.label}
            </h3>
            <p className="m-0 min-h-40 text-body text-ink-2">
              Texto de ejemplo para la sección “{item.label}”. Desplázate para ver cómo el índice
              resalta la sección que estás leyendo. Los clientes llegan 5 minutos antes de la cita y
              pueden reprogramar hasta 2 horas antes sin costo.
            </p>
          </section>
        ))}
      </section>
    </div>
  );
}

export const Default: Story = { render: () => <Article /> };

export const Narrow: Story = { render: () => <Article narrow /> };

export const BrutalPreset: Story = {
  render: () => (
    <div data-style="brutal" className="bg-bg p-card">
      <Article />
    </div>
  ),
};
