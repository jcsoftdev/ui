import { BubbleChart } from "../charts/bubble-chart/index.js";
import { type Candle, CandlestickChart } from "../charts/candlestick-chart/index.js";
import type {
  HierarchyDatum,
  SankeyLinkInput,
  SankeyNodeInput,
  XYPoint,
} from "../charts/core/index.js";
import { GanttChart, type GanttTask } from "../charts/gantt-chart/index.js";
import { PictogramChart } from "../charts/pictogram-chart/index.js";
import { PolarAreaChart } from "../charts/polar-area-chart/index.js";
import { RadarChart } from "../charts/radar-chart/index.js";
import { SankeyChart } from "../charts/sankey-chart/index.js";
import { ScatterChart } from "../charts/scatter-chart/index.js";
import { SunburstChart } from "../charts/sunburst-chart/index.js";
import { TreeChart, type TreeChartDatum } from "../charts/tree-chart/index.js";
import { TreemapChart } from "../charts/treemap-chart/index.js";
import { WaffleChart } from "../charts/waffle-chart/index.js";
import { seeded } from "../dashboards/data.js";
import { BentoGrid, Tile } from "./bento.js";

const ventas: HierarchyDatum = {
  name: "Ventas de octubre",
  children: [
    {
      name: "Cortes",
      children: [
        { name: "Corte clásico", value: 6480 },
        { name: "Degradado", value: 5320 },
        { name: "Corte infantil", value: 1890 },
        { name: "Rapado", value: 760 },
      ],
    },
    {
      name: "Barba",
      children: [
        { name: "Perfilado", value: 2960 },
        { name: "Afeitado clásico", value: 1740 },
        { name: "Toalla caliente", value: 1210 },
      ],
    },
    {
      name: "Productos",
      children: [
        { name: "Cera mate", value: 1480 },
        { name: "Pomada", value: 1120 },
        { name: "Shampoo", value: 860 },
        { name: "Aceite de barba", value: 790 },
      ],
    },
    {
      name: "Color",
      children: [
        { name: "Tinte", value: 1650 },
        { name: "Mechas", value: 980 },
      ],
    },
    {
      name: "Combos",
      children: [
        { name: "Corte + barba", value: 3870 },
        { name: "Novio VIP", value: 900 },
      ],
    },
  ],
};

const sedes: HierarchyDatum = {
  name: "Servicios de octubre",
  children: [
    {
      name: "Miraflores",
      children: [
        {
          name: "Kevin",
          children: [
            { name: "Clásico", value: 64 },
            { name: "Degradado", value: 48 },
            { name: "Barba", value: 22 },
          ],
        },
        {
          name: "Renzo",
          children: [
            { name: "Degradado", value: 57 },
            { name: "Combo", value: 31 },
          ],
        },
      ],
    },
    {
      name: "Barranco",
      children: [
        {
          name: "Abel",
          children: [
            { name: "Clásico", value: 42 },
            { name: "Afeitado", value: 26 },
          ],
        },
        {
          name: "Diego",
          children: [
            { name: "Degradado", value: 38 },
            { name: "Infantil", value: 17 },
          ],
        },
      ],
    },
    {
      name: "San Isidro",
      children: [
        {
          name: "Luis",
          children: [
            { name: "Combo", value: 35 },
            { name: "Clásico", value: 29 },
          ],
        },
      ],
    },
  ],
};

const flujoNodos: SankeyNodeInput[] = [
  { id: "instagram", name: "Instagram" },
  { id: "referidos", name: "Referidos" },
  { id: "google", name: "Google Maps" },
  { id: "paso", name: "Paso por la tienda" },
  { id: "corte", name: "Corte" },
  { id: "barba", name: "Barba" },
  { id: "combo", name: "Corte + barba" },
  { id: "yape", name: "Yape / Plin" },
  { id: "tarjeta", name: "Tarjeta" },
  { id: "efectivo", name: "Efectivo" },
];

const flujoLinks: SankeyLinkInput[] = [
  { source: "instagram", target: "corte", value: 142 },
  { source: "instagram", target: "combo", value: 64 },
  { source: "referidos", target: "corte", value: 88 },
  { source: "referidos", target: "barba", value: 41 },
  { source: "referidos", target: "combo", value: 37 },
  { source: "google", target: "corte", value: 56 },
  { source: "google", target: "barba", value: 22 },
  { source: "paso", target: "corte", value: 47 },
  { source: "paso", target: "barba", value: 29 },
  { source: "corte", target: "yape", value: 196 },
  { source: "corte", target: "tarjeta", value: 78 },
  { source: "corte", target: "efectivo", value: 59 },
  { source: "barba", target: "yape", value: 51 },
  { source: "barba", target: "efectivo", value: 41 },
  { source: "combo", target: "tarjeta", value: 58 },
  { source: "combo", target: "yape", value: 43 },
];

const organigrama: TreeChartDatum = {
  id: "dueno",
  name: "Carlos Mendoza",
  subtitle: "Dueño",
  badge: "3 sedes",
  children: [
    {
      id: "miraflores",
      name: "Lucía Paredes",
      subtitle: "Encargada",
      badge: "Miraflores",
      children: [
        { id: "kevin", name: "Kevin Rojas", subtitle: "Barbero senior" },
        { id: "andrea", name: "Andrea Quispe", subtitle: "Colorista" },
      ],
    },
    {
      id: "surco",
      name: "Jorge Vargas",
      subtitle: "Encargado",
      badge: "Surco",
      children: [
        { id: "luis", name: "Luis Fernández", subtitle: "Barbero senior" },
        { id: "camila", name: "Camila Torres", subtitle: "Recepción" },
      ],
    },
    {
      id: "barranco",
      name: "Valeria Núñez",
      subtitle: "Encargada",
      badge: "Barranco",
      children: [{ id: "abel", name: "Abel Ríos", subtitle: "Barbero" }],
    },
  ],
};

const day = (month: number, date: number) => new Date(2026, month - 1, date);

const remodelacion: GanttTask[] = [
  { id: "plan", name: "Planificación", start: day(9, 14), end: day(9, 26) },
  {
    id: "brief",
    name: "Brief con el dueño",
    parentId: "plan",
    start: day(9, 14),
    end: day(9, 16),
    progress: 1,
  },
  {
    id: "diseno",
    name: "Diseño del local",
    parentId: "plan",
    start: day(9, 16),
    end: day(9, 23),
    progress: 1,
    dependencies: ["brief"],
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
    name: "Demolición",
    parentId: "obra",
    start: day(9, 28),
    end: day(10, 3),
    progress: 1,
    dependencies: ["aprobado"],
  },
  {
    id: "electrico",
    name: "Instalación eléctrica",
    parentId: "obra",
    start: day(10, 5),
    end: day(10, 13),
    progress: 0.6,
    dependencies: ["demolicion"],
  },
  {
    id: "sillones",
    name: "Sillones y lavaderos",
    parentId: "obra",
    start: day(10, 12),
    end: day(10, 21),
    progress: 0.2,
    dependencies: ["electrico"],
  },
  {
    id: "apertura",
    name: "Inauguración",
    start: day(10, 26),
    end: day(10, 26),
    milestone: true,
    dependencies: ["sillones"],
  },
];

const random = seeded(7);
let precio = 42;
const pomada: Candle[] = Array.from({ length: 40 }, (_, index) => {
  const open = precio;
  const close = Math.max(1.6, open + (random() - 0.46) * 3.8);
  const high = Math.max(open, close) + random() * 1.4;
  const low = Math.max(0.8, Math.min(open, close) - random() * 1.4);
  precio = close;
  const round = (value: number) => Math.round(value * 100) / 100;
  return {
    date: new Date(2026, 0, 5 + index * 7),
    open: round(open),
    high: round(high),
    low: round(low),
    close: round(close),
    volume: Math.round(40 + random() * 160),
  };
});

function atenciones(seed: number, count: number, base: number, porMinuto: number): XYPoint[] {
  const next = seeded(seed);
  return Array.from({ length: count }, () => {
    const duracion = Math.round(15 + next() * 55);
    return { x: duracion, y: Math.round(base + duracion * porMinuto + (next() - 0.5) * 22) };
  });
}

const habilidades = ["Corte", "Degradado", "Barba", "Atención", "Puntualidad", "Limpieza"];
const barberos = [
  { id: "kevin", name: "Kevin", data: [92, 88, 70, 85, 90, 78] },
  { id: "renzo", name: "Renzo", data: [75, 95, 82, 70, 65, 88] },
  { id: "abel", name: "Abel", data: [60, 72, 94, 90, 80, 68] },
];

const citasPorDia = [
  { id: "lun", name: "Lunes", value: 18 },
  { id: "mar", name: "Martes", value: 24 },
  { id: "mie", name: "Miércoles", value: 27 },
  { id: "jue", name: "Jueves", value: 33 },
  { id: "vie", name: "Viernes", value: 46 },
  { id: "sab", name: "Sábado", value: 58 },
  { id: "dom", name: "Domingo", value: 12 },
];

const servicios = [
  { label: "Corte clásico", x: 28, y: 35, size: 186 },
  { label: "Degradado", x: 38, y: 45, size: 142 },
  { label: "Corte + barba", x: 52, y: 60, size: 97 },
  { label: "Barba", x: 18, y: 25, size: 74 },
  { label: "Tinte", x: 65, y: 90, size: 31 },
  { label: "Lavado", x: 12, y: 15, size: 22 },
];

const pagos = [
  { id: "yape", name: "Yape", value: 412 },
  { id: "efectivo", name: "Efectivo", value: 268 },
  { id: "tarjeta", name: "Tarjeta", value: 187 },
  { id: "plin", name: "Plin", value: 96 },
];

const clientesHoy = [
  { id: "nuevos", name: "Nuevos", value: 18 },
  { id: "frecuentes", name: "Frecuentes", value: 42 },
  { id: "vip", name: "Membresía VIP", value: 11 },
];

const minutos = (value: number) => `${Math.round(value)} min`;

/** Data-viz gallery: one tile per chart family, in mixed sizes. */
export function DataVizBento() {
  return (
    <BentoGrid rowHeight={136}>
      <Tile title="Treemap" subtitle="Ventas por categoría y producto" cols={4} rows={3} index={0}>
        <TreemapChart
          height="fill"
          title="Ventas por categoría y producto"
          data={ventas}
          valueFormat="currency"
          depth={2}
          legend={false}
        />
      </Tile>
      <Tile title="Sunburst" subtitle="Sede, barbero y servicio" cols={2} rows={3} index={1}>
        <SunburstChart
          height="fill"
          title="Servicios por sede, barbero y servicio"
          data={sedes}
          valueFormat="integer"
          levels={3}
          legend={false}
        />
      </Tile>
      <Tile title="Sankey" subtitle="De dónde vienen y cómo pagan" cols={4} rows={3} index={2}>
        <SankeyChart
          height="fill"
          title="Origen de clientes, servicio y medio de pago"
          nodes={flujoNodos}
          links={flujoLinks}
          columns={["Origen", "Servicio", "Pago"]}
          valueFormat="integer"
        />
      </Tile>
      <Tile title="Radar" subtitle="Evaluación del equipo" cols={2} rows={3} index={3}>
        <RadarChart
          height="fill"
          title="Evaluación de barberos por habilidad"
          axes={habilidades}
          series={barberos}
          valueFormat="integer"
        />
      </Tile>
      <Tile
        title="Gantt"
        subtitle="Remodelación de la sede San Isidro"
        cols={6}
        rows={3}
        index={4}
        flush
      >
        <GanttChart
          height="fill"
          title="Remodelación de la sede San Isidro"
          tasks={remodelacion}
          today={day(10, 8)}
          defaultZoom="week"
        />
      </Tile>
      <Tile title="Velas" subtitle="Precio semanal de la pomada" cols={3} rows={3} index={5}>
        <CandlestickChart
          height="fill"
          title="Precio semanal de la pomada (S/ por unidad)"
          data={pomada}
          valueFormat="currency"
        />
      </Tile>
      <Tile title="Organigrama" subtitle="Equipo por sede" cols={3} rows={3} index={6}>
        <TreeChart height="fill" title="Equipo de la barbería" data={organigrama} />
      </Tile>
      <Tile title="Dispersión" subtitle="Duración vs. ticket" cols={2} rows={2} index={7}>
        <ScatterChart
          height="fill"
          title="Duración del servicio vs. ticket"
          series={[
            { id: "corte", name: "Corte", points: atenciones(401, 40, 10, 0.75) },
            { id: "combo", name: "Combo", points: atenciones(402, 30, 22, 0.9) },
          ]}
          xFormat={minutos}
          yFormat="currency"
        />
      </Tile>
      <Tile title="Burbujas" subtitle="Duración, ticket y volumen" cols={2} rows={2} index={8}>
        <BubbleChart
          height="fill"
          title="Servicios: duración, ticket y volumen"
          series={[{ id: "servicios", name: "Servicios", points: servicios }]}
          xFormat={minutos}
          yFormat="currency"
          sizeFormat="integer"
          sizeLegend={false}
        />
      </Tile>
      <Tile title="Área polar" subtitle="Citas por día" cols={2} rows={2} index={9}>
        <PolarAreaChart
          height="fill"
          title="Citas por día de la semana"
          data={citasPorDia}
          valueFormat="integer"
        />
      </Tile>
      <Tile title="Waffle" subtitle="Pagos del mes" cols={2} rows={2} index={10}>
        <WaffleChart
          height="fill"
          title="Pagos del mes por medio"
          data={pagos}
          rows={10}
          columns={10}
          valueFormat="integer"
        />
      </Tile>
      <Tile title="Pictograma" subtitle="Clientes atendidos hoy" cols={4} rows={2} index={11}>
        <PictogramChart
          height="fill"
          title="Clientes atendidos hoy"
          data={clientesHoy}
          icon="person"
          unitLabel="clientes"
          valueFormat="integer"
        />
      </Tile>
    </BentoGrid>
  );
}
