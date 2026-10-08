import type { Meta, StoryObj } from "@storybook/react-vite";
import { peruMap } from "../maps/data/peru/index.js";
import { worldMap } from "../maps/data/world/index.js";
import type { MapLabels } from "../maps/geo/map-labels.js";
import { selectRegions } from "../maps/geo/topojson.js";
import { BubbleMap, type BubbleMapCategory, type MapPoint } from "./bubble-map.js";

/** Lima Metropolitana y Callao: el mapa base se ajusta a esa zona. */
const limaMap = selectRegions(peruMap, ["PE-LMA", "PE-CAL"]);

/** Sedes de la barbería en Lima; el valor son las citas del mes. */
const branches: MapPoint[] = [
  { id: "mir", name: "Miraflores", lat: -12.1219, lon: -77.0297, value: 1840, category: "propia" },
  { id: "sis", name: "San Isidro", lat: -12.0977, lon: -77.0365, value: 1520, category: "propia" },
  { id: "sur", name: "Surco", lat: -12.145, lon: -76.993, value: 1310, category: "propia" },
  { id: "mol", name: "La Molina", lat: -12.085, lon: -76.94, value: 980, category: "propia" },
  { id: "sbo", name: "San Borja", lat: -12.1067, lon: -76.997, value: 870, category: "franquicia" },
  { id: "bar", name: "Barranco", lat: -12.14, lon: -77.021, value: 760, category: "propia" },
  { id: "jes", name: "Jesús María", lat: -12.07, lon: -77.051, value: 640, category: "franquicia" },
  { id: "olv", name: "Los Olivos", lat: -11.97, lon: -77.07, value: 590, category: "franquicia" },
  { id: "smi", name: "San Miguel", lat: -12.078, lon: -77.09, value: 720, category: "franquicia" },
  { id: "cal", name: "Callao", lat: -12.056, lon: -77.118, value: 430, category: "franquicia" },
  {
    id: "sjl",
    name: "San Juan de Lurigancho",
    lat: -11.985,
    lon: -77.008,
    value: 510,
    category: "franquicia",
  },
  { id: "ate", name: "Ate", lat: -12.026, lon: -76.918, value: 380, category: "franquicia" },
  { id: "cho", name: "Chorrillos", lat: -12.17, lon: -77.012, value: 350, category: "franquicia" },
  { id: "mag", name: "Magdalena", lat: -12.09, lon: -77.072, value: 300, category: "propia" },
  {
    id: "ves",
    name: "Villa El Salvador",
    lat: -12.21,
    lon: -76.933,
    value: 260,
    category: "franquicia",
  },
];

const categories: BubbleMapCategory[] = [
  { id: "propia", name: "Sede propia" },
  { id: "franquicia", name: "Franquicia" },
];

/** Clientes por ciudad del país, con Lima y Arequipa muy densas para probar el agrupamiento. */
const cities: MapPoint[] = [
  ...branches.map((branch) => ({ ...branch, category: undefined })),
  { id: "aqp1", name: "Arequipa Centro", lat: -16.399, lon: -71.537, value: 420 },
  { id: "aqp2", name: "Cayma", lat: -16.37, lon: -71.55, value: 260 },
  { id: "aqp3", name: "Yanahuara", lat: -16.388, lon: -71.545, value: 210 },
  { id: "aqp4", name: "Cerro Colorado", lat: -16.365, lon: -71.58, value: 190 },
  { id: "cus1", name: "Cusco Centro", lat: -13.5319, lon: -71.9675, value: 360 },
  { id: "cus2", name: "San Sebastián", lat: -13.5328, lon: -71.9, value: 150 },
  { id: "tru1", name: "Trujillo Centro", lat: -8.1116, lon: -79.0288, value: 450 },
  { id: "tru2", name: "Víctor Larco", lat: -8.1344, lon: -79.0525, value: 230 },
  { id: "piu", name: "Piura", lat: -5.1945, lon: -80.6328, value: 380 },
  { id: "chi", name: "Chiclayo", lat: -6.7714, lon: -79.8409, value: 330 },
  { id: "iqu", name: "Iquitos", lat: -3.7491, lon: -73.2538, value: 120 },
  { id: "hua", name: "Huancayo", lat: -12.0651, lon: -75.2049, value: 210 },
  { id: "tac", name: "Tacna", lat: -18.0066, lon: -70.2463, value: 140 },
  { id: "pun", name: "Puno", lat: -15.8402, lon: -70.0219, value: 90 },
  { id: "caj", name: "Cajamarca", lat: -7.1638, lon: -78.5003, value: 110 },
  { id: "ica", name: "Ica", lat: -14.0678, lon: -75.7286, value: 160 },
];

const worldCities: MapPoint[] = [
  { id: "lim", name: "Lima", lat: -12.05, lon: -77.04, value: 9800, category: "sudamerica" },
  { id: "bue", name: "Buenos Aires", lat: -34.6, lon: -58.38, value: 2100, category: "sudamerica" },
  { id: "sao", name: "São Paulo", lat: -23.55, lon: -46.63, value: 3400, category: "sudamerica" },
  { id: "bog", name: "Bogotá", lat: 4.71, lon: -74.07, value: 1700, category: "sudamerica" },
  { id: "scl", name: "Santiago", lat: -33.45, lon: -70.67, value: 1500, category: "sudamerica" },
  {
    id: "mex",
    name: "Ciudad de México",
    lat: 19.43,
    lon: -99.13,
    value: 2900,
    category: "norteamerica",
  },
  { id: "nyc", name: "Nueva York", lat: 40.71, lon: -74.0, value: 4200, category: "norteamerica" },
  { id: "mia", name: "Miami", lat: 25.76, lon: -80.19, value: 1900, category: "norteamerica" },
  { id: "tor", name: "Toronto", lat: 43.65, lon: -79.38, value: 800, category: "norteamerica" },
  { id: "mad", name: "Madrid", lat: 40.42, lon: -3.7, value: 2600, category: "europa" },
  { id: "par", name: "París", lat: 48.85, lon: 2.35, value: 1800, category: "europa" },
  { id: "ber", name: "Berlín", lat: 52.52, lon: 13.4, value: 900, category: "europa" },
  { id: "tok", name: "Tokio", lat: 35.68, lon: 139.69, value: 1200, category: "asia" },
  { id: "syd", name: "Sídney", lat: -33.87, lon: 151.21, value: 600, category: "asia" },
  { id: "jnb", name: "Johannesburgo", lat: -26.2, lon: 28.05, value: 300, category: "asia" },
];

const worldCategories: BubbleMapCategory[] = [
  { id: "sudamerica", name: "Sudamérica" },
  { id: "norteamerica", name: "Norteamérica" },
  { id: "europa", name: "Europa" },
  { id: "asia", name: "Asia y Oceanía" },
];

const spanishLabels: Partial<MapLabels> = {
  empty: "Sin sedes para mostrar",
  loading: "Cargando mapa",
  explore:
    "Marcadores del mapa. Usa las flechas para moverte entre ellos, más y menos para acercar, cero para ver todo.",
  region: "Sede",
  category: "Tipo",
  value: "Valor",
  zoomIn: "Acercar",
  zoomOut: "Alejar",
  fit: "Ver todo el mapa",
  controls: "Zoom del mapa",
  noData: "Sin datos",
  longitude: "Longitud",
  latitude: "Latitud",
  cluster: (count) => `Grupo de ${count} sedes`,
};

const meta = {
  title: "Charts/BubbleMap",
  component: BubbleMap,
  tags: ["autodocs"],
  args: {
    title: "Sedes en Lima",
    map: limaMap,
    points: branches,
    categories,
    valueName: "Citas al mes",
    valueFormat: "integer",
    minRadius: 5,
    maxRadius: 22,
    cluster: false,
    clusterDistance: 36,
    regionLabels: false,
    legend: true,
    tooltip: true,
    zoomable: true,
    wheelZoom: "always",
    maxZoom: 16,
    animate: true,
    loading: false,
    labels: spanishLabels,
  },
  argTypes: {
    minRadius: { control: { type: "range", min: 2, max: 16, step: 1 } },
    maxRadius: { control: { type: "range", min: 12, max: 48, step: 1 } },
    clusterDistance: { control: { type: "range", min: 16, max: 80, step: 2 } },
    wheelZoom: { control: "inline-radio", options: ["always", "modifier"] },
    projection: {
      control: "select",
      options: [undefined, "fitted", "equirectangular", "mercator", "equalEarth"],
    },
    height: { control: { type: "range", min: 240, max: 720, step: 10 } },
    map: { control: false },
    points: { control: false },
    categories: { control: false },
    valueFormat: { control: false },
    onPointClick: { control: false },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 640, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BubbleMap>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Sedes de Lima: el área de la burbuja son las citas del mes, el color el tipo de sede. */
export const Default: Story = {
  args: { height: 480 },
};

export const WithRegionNames: Story = {
  args: { height: 480, regionLabels: true },
};

/** Cerca de la zona de Lima los marcadores se agrupan; haz clic en un grupo para acercarte. */
export const Clustered: Story = {
  args: {
    title: "Clientes por ciudad",
    map: peruMap,
    points: cities,
    categories: undefined,
    valueName: "Clientes",
    cluster: true,
    maxRadius: 30,
    height: 560,
  },
};

export const ClusteringOff: Story = {
  args: { ...Clustered.args, cluster: false },
};

export const World: Story = {
  args: {
    title: "Clientes por ciudad en el mundo",
    map: worldMap,
    points: worldCities,
    categories: worldCategories,
    valueName: "Clientes",
    maxRadius: 34,
    wheelZoom: "modifier",
    height: undefined,
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 880, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
};

export const Loading: Story = {
  args: { loading: true, height: 320 },
};

export const Empty: Story = {
  args: { points: [], height: 320 },
};

/** 320 px container: legend below the map, bubbles keep their screen size. */
export const Narrow: Story = {
  args: { height: 360 },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};

/** Drag the corner: the map fits the box exactly, width and height. */
export const FillParent: Story = {
  args: { height: "fill" },
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div
        style={{
          width: 560,
          height: 440,
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
