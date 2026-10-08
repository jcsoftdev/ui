import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import type { MapPoint, MapRoute } from "../bubble-map/bubble-map.js";
import type { ChoroplethDatum } from "../choropleth-map/choropleth-map.js";
import { worldMap } from "../maps/data/world/index.js";
import type { GlobeRotation } from "../maps/geo/globe.js";
import { GlobeChart, type GlobeLabels } from "./globe-chart.js";

/** Pedidos de pomada y cera por país, desde el taller de Lima. */
const orders: ChoroplethDatum[] = (
  [
    ["PER", 5200],
    ["BRA", 780],
    ["CHL", 1360],
    ["COL", 910],
    ["ARG", 640],
    ["ECU", 520],
    ["BOL", 330],
    ["URY", 190],
    ["MEX", 690],
    ["USA", 1920],
    ["CAN", 340],
    ["ESP", 1160],
    ["FRA", 410],
    ["DEU", 530],
    ["ITA", 370],
    ["GBR", 480],
    ["JPN", 250],
    ["AUS", 140],
    ["ZAF", 60],
  ] as const
).map(([id, value]) => ({ id, value }));

const cities: MapPoint[] = [
  { id: "lim", name: "Lima", lat: -12.05, lon: -77.04, value: 5200, category: "Sudamérica" },
  { id: "scl", name: "Santiago", lat: -33.45, lon: -70.67, value: 1360, category: "Sudamérica" },
  { id: "bog", name: "Bogotá", lat: 4.71, lon: -74.07, value: 910, category: "Sudamérica" },
  {
    id: "mex",
    name: "Ciudad de México",
    lat: 19.43,
    lon: -99.13,
    value: 690,
    category: "Norteamérica",
  },
  { id: "nyc", name: "Nueva York", lat: 40.71, lon: -74.0, value: 1920, category: "Norteamérica" },
  { id: "mad", name: "Madrid", lat: 40.42, lon: -3.7, value: 1160, category: "Europa" },
  { id: "ber", name: "Berlín", lat: 52.52, lon: 13.4, value: 530, category: "Europa" },
  { id: "tok", name: "Tokio", lat: 35.68, lon: 139.69, value: 250, category: "Asia y Oceanía" },
  { id: "syd", name: "Sídney", lat: -33.87, lon: 151.21, value: 140, category: "Asia y Oceanía" },
];

const routes: MapRoute[] = [
  { id: "r1", from: "lim", to: "mad", value: 1160, name: "Lima → Madrid" },
  { id: "r2", from: "lim", to: "nyc", value: 1920, name: "Lima → Nueva York" },
  { id: "r3", from: "lim", to: "tok", value: 250, name: "Lima → Tokio" },
  { id: "r4", from: "lim", to: "syd", value: 140, name: "Lima → Sídney" },
  { id: "r5", from: "lim", to: "ber", value: 530, name: "Lima → Berlín" },
];

const spanishLabels: Partial<GlobeLabels> = {
  empty: "Sin datos para el globo",
  loading: "Cargando globo",
  explore:
    "Globo terráqueo. Arrastra o usa las flechas para girarlo, cero para volver a la vista inicial, espacio para pausar el giro.",
  region: "País",
  value: "Pedidos",
  noData: "Sin datos",
  longitude: "Longitud",
  latitude: "Latitud",
  resetView: "Vista inicial",
  pauseSpin: "Pausar giro",
  playSpin: "Girar",
  centerAt: (lon, lat) =>
    `Centrado en ${Math.abs(Math.round(lat))}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(Math.round(lon))}° ${lon >= 0 ? "E" : "O"}`,
  routes: "Rutas",
  origin: "Origen",
  destination: "Destino",
};

const meta = {
  title: "Charts/GlobeChart",
  component: GlobeChart,
  tags: ["autodocs"],
  args: {
    title: "Pedidos por país",
    map: worldMap,
    data: orders,
    valueName: "Pedidos",
    valueFormat: "integer",
    scale: "sequential",
    graticule: true,
    graticuleStep: 30,
    autoRotate: false,
    autoRotateSpeed: 8,
    legend: true,
    tooltip: true,
    loading: false,
    labels: spanishLabels,
  },
  argTypes: {
    scale: { control: "inline-radio", options: ["sequential", "diverging"] },
    graticule: { control: "boolean" },
    graticuleStep: { control: { type: "range", min: 10, max: 45, step: 5 } },
    autoRotate: { control: "boolean" },
    autoRotateSpeed: { control: { type: "range", min: 2, max: 40, step: 1 } },
    height: { control: { type: "range", min: 220, max: 720, step: 10 } },
    map: { control: false },
    data: { control: false },
    points: { control: false },
    routes: { control: false },
    ranges: { control: false },
    colors: { control: false },
    valueFormat: { control: false },
    rotation: { control: false },
    initialRotation: { control: false },
    onRegionClick: { control: false },
    onPointClick: { control: false },
    onRotationChange: { control: false },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 560, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof GlobeChart>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Arrastra para girar el globo, flechas del teclado (Shift gira más), `0` vuelve a Lima. */
export const Default: Story = {};

/** Burbujas por ciudad y rutas de gran círculo elevadas sobre la superficie. */
export const MarkersAndRoutes: Story = {
  args: {
    title: "Envíos desde Lima",
    points: cities,
    routes,
    initialRotation: { lon: -40, lat: 25 },
  },
};

/** Giro lento que se detiene al apuntar o enfocar; desaparece con `prefers-reduced-motion`. */
export const AutoRotate: Story = {
  args: { autoRotate: true, points: cities, initialRotation: { lon: 0, lat: 15 } },
};

/** Contenedor de 320 px: el globo es un disco que cabe en el ancho, la leyenda baja. */
export const Narrow: Story = {
  args: { points: cities },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};

/** El globo toma el tamaño exacto de su caja: arrastra la esquina. */
export const FillParent: Story = {
  args: { height: "fill", points: cities, routes },
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div
        style={{
          width: 560,
          height: 420,
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

/** El mismo globo bajo el preset `brutal`: bordes duros y tokens de escala propios. */
export const BrutalPreset: Story = {
  args: { points: cities, routes },
  decorators: [
    (Story) => (
      <div data-style="brutal" className="bg-bg p-card">
        <Story />
      </div>
    ),
  ],
};

/** Vista controlada: el padre guarda el centro y puede moverlo, por ejemplo con botones. */
export const Controlled: Story = {
  render: (args) => {
    const [rotation, setRotation] = useState<GlobeRotation>({ lon: -75, lat: -10 });
    const places: Array<[string, GlobeRotation]> = [
      ["Lima", { lon: -77, lat: -12 }],
      ["Madrid", { lon: -4, lat: 40 }],
      ["Tokio", { lon: 140, lat: 36 }],
    ];
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {places.map(([name, target]) => (
            <button
              key={name}
              type="button"
              onClick={() => setRotation(target)}
              className="cursor-pointer rounded-button border-0 bg-surface-2 px-3 py-1 font-semibold text-[12px] text-ink-2 hover:text-ink"
            >
              {name}
            </button>
          ))}
        </div>
        <GlobeChart {...args} rotation={rotation} onRotationChange={setRotation} />
      </div>
    );
  },
  args: { points: cities },
};

export const Loading: Story = { args: { loading: true, height: 320 } };

export const Empty: Story = {
  args: {
    data: [],
    map: {
      ...worldMap,
      topology: {
        ...worldMap.topology,
        objects: { paises: { type: "GeometryCollection", geometries: [] } },
      },
    },
    height: 320,
  },
};
