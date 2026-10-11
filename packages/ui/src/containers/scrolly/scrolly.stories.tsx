import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import type { ChartAnnotation } from "../../charts/core/types.js";
import { LineChart } from "../../charts/line-chart/line-chart.js";
import { Scrolly, ScrollyStep } from "./scrolly.js";

const days = Array.from({ length: 30 }, (_, i) => new Date(2026, 8, 1 + i));
const sales = days.map((date, i) => {
  const weekday = date.getDay();
  const promo = i >= 14 ? 160 + (i - 14) * 12 : 0;
  const bump = weekday === 6 ? 520 : weekday === 5 ? 240 : weekday === 0 ? -480 : 0;
  return Math.round(1020 + 140 * Math.sin(i / 2.4) + bump + promo);
});
const lastMonth = sales.map((value, i) =>
  Math.round(value * (0.86 + 0.03 * Math.sin(i / 3)) - (i >= 14 ? 120 : 0)),
);

interface Chapter {
  title: string;
  body: string;
  /** Days of the month shown so far. */
  until: number;
  notes: ChartAnnotation[];
  compare?: boolean;
}

const saturdays = days.filter((date) => date.getDay() === 6);

const chapters: Chapter[] = [
  {
    title: "Septiembre arrancó tranquilo",
    body: "Las dos primeras semanas rondaron los S/ 1 000 diarios: sábados llenos, domingos a media jornada y entre semana con huecos en la agenda.",
    until: 13,
    notes: [],
  },
  {
    title: "El 15 llegó el combo corte + barba",
    body: "Lanzamos el combo a S/ 55 con reserva en línea. Desde ese día el promedio diario dejó de bajar los martes y miércoles.",
    until: 20,
    notes: [{ type: "line", axis: "x", value: days[14] as Date, label: "Combo", tone: "accent" }],
  },
  {
    title: "Los sábados se desbordaron",
    body: "Cuatro sábados seguidos con agenda completa. Abrimos dos sillas más desde las 9 a. m. y aun así hubo lista de espera.",
    until: 29,
    notes: [
      { type: "line", axis: "x", value: days[14] as Date, label: "Combo", tone: "accent" },
      ...saturdays.map(
        (date): ChartAnnotation => ({
          type: "point",
          x: date,
          y: sales[date.getDate() - 1] as number,
          tone: "success",
        }),
      ),
    ],
  },
  {
    title: "Cerramos el mes 18 % arriba",
    body: "Comparado con agosto, la segunda quincena creció sin gastar más en publicidad: el combo trajo clientes que volvieron a reservar.",
    until: 29,
    notes: [{ type: "line", axis: "x", value: days[14] as Date, label: "Combo", tone: "accent" }],
    compare: true,
  },
];

function SalesGraphic({ step }: { step: number }) {
  const chapter = chapters[step] as Chapter;
  return (
    <LineChart
      title="Ventas diarias de septiembre"
      categories={days}
      series={[
        {
          id: "ventas",
          name: "Septiembre",
          data: sales.map((value, i) => (i <= chapter.until ? value : null)),
        },
        ...(chapter.compare
          ? [{ id: "agosto", name: "Agosto", data: lastMonth, dashed: true }]
          : []),
      ]}
      annotations={chapter.notes}
      valueFormat="currency"
      curve="smooth"
      transition
      height="fill"
      yAxis={{ min: 0, max: 2200 }}
      legend={chapter.compare ? "top" : false}
      labels={{ explore: "Ventas diarias. Usa las flechas para recorrer los días." }}
    />
  );
}

function Narrative({ side = "end" }: { side?: "start" | "end" }) {
  return (
    <Scrolly
      aria-label="Historia de septiembre"
      graphicSide={side}
      graphic={({ step }) => <SalesGraphic step={step} />}
    >
      {chapters.map((chapter, index) => (
        <ScrollyStep key={chapter.title}>
          <p className="m-0 font-semibold text-accent-ink text-meta uppercase tracking-wide">
            Paso {index + 1} de {chapters.length}
          </p>
          <h3 className="m-0 mt-1 font-bold text-ink text-xl">{chapter.title}</h3>
          <p className="m-0 mt-2 max-w-prose text-ink-2 text-sm leading-relaxed">{chapter.body}</p>
        </ScrollyStep>
      ))}
    </Scrolly>
  );
}

const meta = {
  title: "Containers/Scrolly",
  component: Scrolly,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: { graphic: () => null, children: null },
  argTypes: {
    graphic: { control: false },
    children: { control: false },
    root: { control: false },
    onStepChange: { control: false },
    offset: { control: { type: "range", min: 0, max: 1, step: 0.05 } },
    graphicSide: { control: "inline-radio", options: ["start", "end"] },
  },
} satisfies Meta<typeof Scrolly>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Desplázate: el gráfico queda fijo y cambia con el paso activo (el que cruza la línea del centro).
 * En un contenedor ancho el gráfico va al lado; en uno angosto se fija arriba.
 */
export const Default: Story = {
  parameters: { a11y: { test: "todo" } },
  render: (args) => (
    <div style={{ padding: 16 }}>
      <Narrative side={args.graphicSide} />
    </div>
  ),
};

/** 320 px: el gráfico se fija arriba y los pasos pasan debajo. */
export const Narrow: Story = {
  parameters: { a11y: { test: "todo" } },
  render: () => (
    <div style={{ width: 320, padding: "0 0 16px" }}>
      <Narrative />
    </div>
  ),
};

/** Paso controlado desde fuera: los botones saltan al paso y la lectura sigue el scroll. */
export const WithStepIndicator: Story = {
  parameters: { a11y: { test: "todo" } },
  render: () => {
    const [step, setStep] = useState(0);
    return (
      <div style={{ padding: 16 }}>
        <p
          className="sticky top-0 z-20 m-0 bg-bg py-2 font-semibold text-ink-2 text-meta"
          aria-live="polite"
        >
          Paso activo: {step + 1} de {chapters.length}
        </p>
        <Scrolly
          aria-label="Historia de septiembre"
          onStepChange={setStep}
          graphic={({ step: active }) => <SalesGraphic step={active} />}
        >
          {chapters.map((chapter) => (
            <ScrollyStep key={chapter.title}>
              <h3 className="m-0 font-bold text-ink text-xl">{chapter.title}</h3>
              <p className="m-0 mt-2 max-w-prose text-ink-2 text-sm">{chapter.body}</p>
            </ScrollyStep>
          ))}
        </Scrolly>
      </div>
    );
  },
};

/** Con el preset `brutal`: bordes duros y la misma narrativa. */
export const BrutalPreset: Story = {
  parameters: { a11y: { test: "todo" } },
  render: () => (
    <div data-style="brutal" className="bg-bg p-card">
      <Narrative side="start" />
    </div>
  ),
};
