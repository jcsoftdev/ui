import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { GanttChart, type GanttTask } from "./gantt-chart.js";

const day = (month: number, date: number, hour = 0) => new Date(2026, month - 1, date, hour);

/** Remodeling of the San Isidro branch: three phases, milestones and finish-to-start links. */
const remodelacion: GanttTask[] = [
  { id: "plan", name: "Planificación", start: day(9, 14), end: day(9, 26) },
  {
    id: "brief",
    name: "Brief con el dueño",
    parentId: "plan",
    start: day(9, 14),
    end: day(9, 16),
    progress: 1,
    assignee: "Lucía Paredes",
  },
  {
    id: "diseno",
    name: "Diseño del local",
    parentId: "plan",
    start: day(9, 16),
    end: day(9, 23),
    progress: 1,
    dependencies: ["brief"],
    assignee: "Estudio Vértice",
  },
  {
    id: "presupuesto",
    name: "Presupuesto y compras",
    parentId: "plan",
    start: day(9, 21),
    end: day(9, 26),
    progress: 1,
    dependencies: ["brief"],
    color: "var(--chart-cat-2)",
    assignee: "Mateo Rojas",
  },
  {
    id: "aprobado",
    name: "Diseño aprobado",
    parentId: "plan",
    start: day(9, 25),
    end: day(9, 25),
    milestone: true,
    dependencies: ["diseno"],
  },
  { id: "obra", name: "Obra", start: day(9, 28), end: day(10, 24) },
  {
    id: "demolicion",
    name: "Demolición y retiro",
    parentId: "obra",
    start: day(9, 28),
    end: day(10, 3),
    progress: 1,
    dependencies: ["aprobado"],
    color: "var(--chart-cat-1)",
    assignee: "Constructora Lima Sur",
  },
  {
    id: "electrico",
    name: "Instalación eléctrica",
    parentId: "obra",
    start: day(10, 5),
    end: day(10, 13),
    progress: 0.6,
    dependencies: ["demolicion"],
    color: "var(--chart-cat-1)",
    assignee: "Ing. Diego Salas",
  },
  {
    id: "gasfiteria",
    name: "Gasfitería y lavaderos",
    parentId: "obra",
    start: day(10, 5),
    end: day(10, 10),
    progress: 0.8,
    dependencies: ["demolicion"],
    color: "var(--chart-cat-1)",
  },
  {
    id: "pisos",
    name: "Pisos y paredes",
    parentId: "obra",
    start: day(10, 12),
    end: day(10, 20),
    progress: 0.1,
    dependencies: ["gasfiteria"],
    color: "var(--chart-cat-1)",
  },
  {
    id: "pintura",
    name: "Pintura y señalética",
    parentId: "obra",
    start: day(10, 20),
    end: day(10, 24),
    dependencies: ["pisos", "electrico"],
    color: "var(--chart-cat-1)",
  },
  { id: "equipamiento", name: "Equipamiento", start: day(10, 21), end: day(11, 5) },
  {
    id: "sillones",
    name: "Sillones y espejos",
    parentId: "equipamiento",
    start: day(10, 24),
    end: day(10, 29),
    dependencies: ["pintura"],
    color: "var(--chart-cat-4)",
    assignee: "Proveedor Barber Pro",
  },
  {
    id: "caja",
    name: "Caja y sistema de citas",
    parentId: "equipamiento",
    start: day(10, 21),
    end: day(10, 27),
    progress: 0.25,
    color: "var(--chart-cat-4)",
    assignee: "Valeria Quispe",
  },
  {
    id: "capacitacion",
    name: "Capacitación del equipo",
    parentId: "equipamiento",
    start: day(10, 29),
    end: day(11, 3),
    dependencies: ["sillones", "caja"],
    color: "var(--chart-cat-4)",
  },
  {
    id: "inauguracion",
    name: "Inauguración",
    start: day(11, 5),
    end: day(11, 5),
    milestone: true,
    dependencies: ["capacitacion"],
    color: "var(--accent-word)",
  },
];

/** Opening day, hour by hour. */
const inauguracion: GanttTask[] = [
  {
    id: "montaje",
    name: "Montaje de globos y banner",
    start: day(11, 5, 7),
    end: day(11, 5, 9),
    progress: 1,
  },
  {
    id: "prensa",
    name: "Recepción de prensa",
    start: day(11, 5, 9),
    end: day(11, 5, 10),
    dependencies: ["montaje"],
  },
  {
    id: "corte",
    name: "Corte de cinta",
    start: day(11, 5, 10),
    end: day(11, 5, 10),
    milestone: true,
    dependencies: ["prensa"],
  },
  {
    id: "promo",
    name: "Cortes con 50% de descuento",
    start: day(11, 5, 10),
    end: day(11, 5, 18),
    dependencies: ["corte"],
    color: "var(--chart-cat-2)",
  },
  {
    id: "dj",
    name: "DJ y bebidas",
    start: day(11, 5, 12),
    end: day(11, 5, 16),
    color: "var(--chart-cat-4)",
  },
  {
    id: "cierre",
    name: "Cierre de caja",
    start: day(11, 5, 18),
    end: day(11, 5, 19),
    dependencies: ["promo"],
  },
];

const spanishLabels = {
  empty: "Sin tareas en este proyecto",
  loading: "Cargando cronograma",
  category: "Tarea",
};

const spanishTexts = {
  tasks: "Tareas",
  start: "Inicio",
  end: "Fin",
  progress: "Avance",
  duration: "Duración",
  milestone: "Hito",
  assignee: "Responsable",
  dependsOn: "Depende de",
  day: "día",
  days: "días",
  hours: "h",
  today: "Hoy",
  zoom: "Escala de tiempo",
  zoomLevels: {
    hour: "Horas",
    day: "Días",
    week: "Semanas",
    month: "Meses",
    quarter: "Trimestres",
    year: "Año",
  },
  zoomShort: { hour: "H", day: "D", week: "S", month: "M", quarter: "T", year: "A" },
  baseline: "Plan original",
  variance: "Desvío",
  criticalPath: "Ruta crítica",
  critical: "Crítica",
  slack: "Holgura",
  annotations: "Anotaciones",
  exportTexts: { export: "Exportar", svg: "SVG", png: "PNG" },
  divider: "Ancho de la lista de tareas",
  keyboardHint:
    "Flechas arriba y abajo recorren las tareas; izquierda y derecha pliegan o despliegan fases. Si es editable: Alt y flechas mueven, Mayús y flechas cambian el fin, más y menos cambian el avance.",
  quarter: (quarter: number) => `T${quarter}`,
};

/** The original plan: the same tasks a few days earlier or shorter, so the actuals show slippage. */
const planOriginal: Record<string, { start: Date; end: Date }> = {
  brief: { start: day(9, 14), end: day(9, 16) },
  diseno: { start: day(9, 16), end: day(9, 21) },
  presupuesto: { start: day(9, 21), end: day(9, 25) },
  demolicion: { start: day(9, 28), end: day(10, 2) },
  electrico: { start: day(10, 5), end: day(10, 10) },
  gasfiteria: { start: day(10, 5), end: day(10, 9) },
  pisos: { start: day(10, 9), end: day(10, 16) },
  pintura: { start: day(10, 16), end: day(10, 20) },
  sillones: { start: day(10, 20), end: day(10, 24) },
  caja: { start: day(10, 21), end: day(10, 27) },
  capacitacion: { start: day(10, 27), end: day(10, 31) },
};

const conBaseline: GanttTask[] = remodelacion.map((task) => ({
  ...task,
  baseline: planOriginal[task.id],
}));

/** Release dates and a closure that the plan has to respect. */
const hitosDeNegocio = [
  { id: "feriado", at: day(10, 8), label: "Feriado: sin obra" },
  {
    id: "proveedor",
    at: day(10, 14),
    to: day(10, 17),
    label: "Corte de luz programado",
    color: "var(--danger)",
  },
  { id: "cita", at: day(11, 5), label: "Apertura al público", color: "var(--success)" },
];

/** Only milestones: the key dates of the opening. */
const soloHitos: GanttTask[] = [
  { id: "contrato", name: "Contrato firmado", start: day(9, 14), end: day(9, 14), milestone: true },
  {
    id: "permiso",
    name: "Licencia municipal",
    start: day(9, 25),
    end: day(9, 25),
    milestone: true,
    color: "var(--chart-cat-2)",
  },
  {
    id: "entrega",
    name: "Entrega de la obra",
    start: day(10, 24),
    end: day(10, 24),
    milestone: true,
    color: "var(--chart-cat-4)",
  },
  {
    id: "equipos",
    name: "Equipos instalados",
    start: day(10, 29),
    end: day(10, 29),
    milestone: true,
    color: "var(--chart-cat-4)",
  },
  {
    id: "apertura",
    name: "Apertura",
    start: day(11, 5),
    end: day(11, 5),
    milestone: true,
    color: "var(--accent-word)",
  },
];

/** Progress from not started to done, with a parent that rolls it up. */
const avances: GanttTask[] = [
  { id: "campana", name: "Campaña de reapertura", start: day(10, 1), end: day(10, 31) },
  {
    id: "fotos",
    name: "Sesión de fotos",
    parentId: "campana",
    start: day(10, 1),
    end: day(10, 8),
    progress: 1,
  },
  {
    id: "web",
    name: "Landing de reservas",
    parentId: "campana",
    start: day(10, 5),
    end: day(10, 18),
    progress: 0.65,
  },
  {
    id: "redes",
    name: "Anuncios en redes",
    parentId: "campana",
    start: day(10, 12),
    end: day(10, 26),
    progress: 0.25,
  },
  {
    id: "sorteo",
    name: "Sorteo de cortes gratis",
    parentId: "campana",
    start: day(10, 22),
    end: day(10, 31),
    progress: 0,
  },
];

const meta = {
  title: "Charts/GanttChart",
  component: GanttChart,
  tags: ["autodocs"],
  args: {
    title: "Remodelación de la sede San Isidro",
    tasks: remodelacion,
    today: day(10, 8),
    defaultZoom: "day",
    rowHeight: 36,
    editable: false,
    dependencies: true,
    tooltip: true,
    loading: false,
    animate: true,
    texts: spanishTexts,
    labels: spanishLabels,
  },
  argTypes: {
    tasks: { control: false },
    today: { control: false },
    holidays: { control: false },
    defaultZoom: {
      control: "inline-radio",
      options: ["hour", "day", "week", "month", "quarter"],
    },
    rowHeight: { control: { type: "range", min: 28, max: 48, step: 2 } },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 1040, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof GanttChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: { a11y: { test: "todo" } },
  args: { holidays: [day(10, 8)] },
};

/** Drag bars to move them, their edges to resize, the triangle to change progress. */
export const Editable: Story = {
  parameters: { a11y: { test: "todo" } },
  args: { editable: true },
  render: function Render(args) {
    const [tasks, setTasks] = useState(args.tasks);
    return (
      <GanttChart
        {...args}
        tasks={tasks}
        onTaskChange={(change) =>
          setTasks((current) =>
            current.map((task) =>
              task.id === change.id
                ? { ...task, start: change.start, end: change.end, progress: change.progress }
                : task,
            ),
          )
        }
      />
    );
  },
};

export const Weeks: Story = {
  parameters: { a11y: { test: "todo" } },
  args: { defaultZoom: "week" },
};

export const Quarters: Story = {
  parameters: { a11y: { test: "todo" } },
  args: { defaultZoom: "quarter", rowHeight: 30 },
};

export const Collapsed: Story = {
  parameters: { a11y: { test: "todo" } },
  args: { defaultCollapsed: ["plan", "obra"] },
};

export const OpeningDayHours: Story = {
  parameters: { a11y: { test: "todo" } },
  args: {
    title: "Día de inauguración",
    tasks: inauguracion,
    defaultZoom: "hour",
    today: day(11, 5, 11),
    zoomLevels: ["hour", "day"],
  },
};

export const WithoutDependencies: Story = {
  parameters: { a11y: { test: "todo" } },
  args: { dependencies: false, today: false },
};

export const Loading: Story = { args: { loading: true } };

export const Empty: Story = { args: { tasks: [] } };

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};

/** Drag the corner: the chart fills the box exactly; rows scroll inside. */
export const FillParent: Story = {
  args: { height: "fill" },
  parameters: { a11y: { test: "todo" }, layout: "padded" },
  decorators: [
    (Story) => (
      <div
        style={{
          width: 720,
          height: 380,
          resize: "both",
          overflow: "hidden",
          outline: "1px dashed var(--line-strong)",
        }}
      >
        <Story />
      </div>
    ),
  ],
};

/** Tasks with no slack are red, with the links that chain them; the others show their slack in the tooltip. */
export const CriticalPath: Story = {
  parameters: { a11y: { test: "todo" } },
  args: { showCriticalPath: true },
};

/** Thin grey bars under each task are the original plan; the tooltip shows the variance. */
export const Baselines: Story = {
  parameters: { a11y: { test: "todo" } },
  args: { tasks: conBaseline, showBaselines: true, showCriticalPath: false },
};

/** Dated lines and bands for closures, deadlines and the opening. */
export const Annotations: Story = {
  parameters: { a11y: { test: "todo" } },
  args: { annotations: hitosDeNegocio, holidays: [day(10, 8)] },
};

/** The whole project on one screen: years above, quarters below. */
export const YearView: Story = {
  parameters: { a11y: { test: "todo" } },
  args: { defaultZoom: "year", rowHeight: 30 },
};

/** Diamonds only: the key dates of the opening. */
export const Milestones: Story = {
  parameters: { a11y: { test: "todo" } },
  args: {
    title: "Hitos de la apertura",
    tasks: soloHitos,
    dependencies: false,
    defaultZoom: "week",
    today: day(10, 8),
  },
};

/** Not started, partly done and finished; the campaign rolls up the weighted progress of its tasks. */
export const Progress: Story = {
  parameters: { a11y: { test: "todo" } },
  args: { title: "Campaña de reapertura", tasks: avances, today: day(10, 14), defaultZoom: "week" },
};

/** The SVG and PNG buttons download the timeline, header included. */
export const Export: Story = {
  parameters: { a11y: { test: "todo" } },
  args: {
    tasks: conBaseline,
    showBaselines: true,
    showCriticalPath: true,
    annotations: hitosDeNegocio,
    exportable: true,
  },
};
