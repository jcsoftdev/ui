import type { Meta, StoryObj } from "@storybook/react-vite";
import { BarChart } from "../../bar-chart/bar-chart.js";
import { LineChart } from "../../line-chart/line-chart.js";
import { ExportMenu } from "../export-menu.js";
import { ChartInkToolbar, type InkLabels, useChartInk } from "./ink-layer.js";

const days = Array.from({ length: 21 }, (_, i) => new Date(2026, 8, 14 + i));
const sales = days.map((date, i) => {
  const weekday = date.getDay();
  const bump = weekday === 6 ? 620 : weekday === 5 ? 280 : weekday === 0 ? -540 : 0;
  return Math.round(1180 + 210 * Math.sin(i / 2.6) + bump + i * 6);
});
const barbers = ["Luis", "Ana", "Marco", "Rosa", "Julio"];
const cuts = [64, 57, 61, 48, 39];

const spanish: Partial<InkLabels> = {
  tools: "Herramientas de anotación",
  ruler: "Regla",
  ink: "Lápiz",
  undo: "Deshacer",
  redo: "Rehacer",
  clear: "Borrar todo",
  steps: (count) => `${count} ${count === 1 ? "barbero" : "barberos"}`,
  deltaValue: "Δ cortes",
  deltaCategory: "Δ barberos",
  plot: "Gráfico de anotación: las flechas mueven la mira, Mayús va más rápido, Espacio fija un punto, Intro termina, Escape cancela",
  position: (x, y) => `${x}, ${y}`,
  pending: (count) => `${count} ${count === 1 ? "punto fijado" : "puntos fijados"}`,
  finished: "Trazo terminado",
};

type Kind = "line" | "bars" | "hbars" | "dense";

const hours = Array.from({ length: 4000 }, (_, i) => new Date(2026, 5, 1, i));
const traffic = hours.map((_, i) =>
  Math.round(
    40 + 18 * Math.sin(i / 11) + 9 * Math.sin(i / 3.7) + (i % 24 > 9 && i % 24 < 20 ? 22 : 0),
  ),
);

function InkDemo({ kind, tool }: { kind: Kind; tool?: "ruler" | "ink" }) {
  const ink = useChartInk({ labels: spanish, tool });
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ChartInkToolbar ink={ink} />
        <ExportMenu
          title={kind === "line" ? "Ventas diarias" : "Cortes por barbero"}
          texts={{ export: "Exportar", svg: "SVG", png: "PNG" }}
          getSvgs={(root) =>
            Array.from(
              root.closest("[data-ink-demo]")?.querySelectorAll<SVGSVGElement>("svg[role='img']") ??
                [],
            )
          }
        />
      </div>
      {kind === "line" ? (
        <LineChart
          title="Ventas diarias"
          categories={days}
          series={[{ id: "ventas", name: "Ventas", data: sales }]}
          valueFormat="currency"
          height={300}
          overlay={ink.overlay}
          legend={false}
          labels={{ explore: "Ventas diarias. Usa las flechas para recorrer los días." }}
        />
      ) : kind === "dense" ? (
        <LineChart
          title="Clientes por hora"
          categories={hours}
          series={[{ id: "clientes", name: "Clientes", data: traffic }]}
          height={300}
          maxPoints={240}
          overlay={ink.overlay}
          legend={false}
        />
      ) : (
        <BarChart
          title="Cortes por barbero"
          categories={barbers}
          series={[{ id: "cortes", name: "Cortes", data: cuts }]}
          orientation={kind === "hbars" ? "horizontal" : "vertical"}
          height={300}
          overlay={ink.overlay}
          legend={false}
        />
      )}
    </div>
  );
}

const meta = {
  title: "Charts/InkAnnotations",
  component: ChartInkToolbar,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  argTypes: { ink: { control: false }, className: { control: false } },
  decorators: [
    (Story) => (
      <div data-ink-demo="" style={{ maxWidth: 640, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ChartInkToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

const placeholder = {} as never;

/**
 * Regla y lápiz sobre un gráfico cartesiano: activa la regla y arrastra entre dos puntos para ver Δx
 * (días) y Δy (soles y %); con el lápiz dibujas a mano alzada. Las marcas viven en unidades de datos y
 * salen en la exportación SVG/PNG.
 */
export const Default: Story = {
  parameters: { a11y: { test: "todo" } },
  args: { ink: placeholder },
  render: () => <InkDemo kind="line" tool="ruler" />,
};

/** Con el lápiz activo, sobre barras: la regla mide en barberos (eje categórico) y en cortes. */
export const OnBars: Story = {
  parameters: { a11y: { test: "todo" } },
  args: { ink: placeholder },
  render: () => <InkDemo kind="bars" tool="ink" />,
};

/**
 * Barras horizontales (barberos en el eje vertical, cortes en el horizontal): la regla mide Δ cortes
 * en unidades de valor sobre el eje X y Δ barberos sobre el Y. Con teclado, izquierda y derecha mueven
 * el valor; arriba y abajo cambian de barbero.
 */
export const OnHorizontalBars: Story = {
  parameters: { a11y: { test: "todo" } },
  args: { ink: placeholder },
  render: () => <InkDemo kind="hbars" tool="ruler" />,
};

/** 320 px: la barra de herramientas se parte en filas y el gráfico llena el ancho. */
export const Narrow: Story = {
  parameters: { a11y: { test: "todo" } },
  args: { ink: placeholder },
  render: () => (
    <div style={{ width: 320 }}>
      <InkDemo kind="line" tool="ruler" />
    </div>
  ),
};

/** Mismo gráfico con el preset `brutal`. */
export const BrutalPreset: Story = {
  parameters: { a11y: { test: "todo" } },
  args: { ink: placeholder },
  render: () => (
    <div data-style="brutal" className="bg-bg p-card">
      <InkDemo kind="line" tool="ruler" />
    </div>
  ),
};

/**
 * Con teclado: activa la regla en la barra de herramientas, enfoca el gráfico (Tab) y mueve la mira con
 * las flechas (Mayús avanza más rápido). Espacio o Intro fija el primer punto y el segundo mide; con el
 * lápiz, Espacio añade vértices e Intro termina. Escape cancela. La medida se anuncia en voz alta.
 */
export const Keyboard: Story = {
  parameters: { a11y: { test: "todo" } },
  args: { ink: placeholder },
  render: () => <InkDemo kind="line" tool="ruler" />,
};

/** 4 000 puntos por hora reducidos a 240: la regla sigue midiendo en tiempo real, no en muestras. */
export const Downsampled: Story = {
  parameters: { a11y: { test: "todo" } },
  args: { ink: placeholder },
  render: () => <InkDemo kind="dense" tool="ruler" />,
};
