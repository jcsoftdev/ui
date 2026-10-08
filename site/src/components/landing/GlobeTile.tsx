import {
  type ChoroplethDatum,
  GlobeChart,
  type MapPoint,
  type MapRoute,
} from "@jcsoftdev/ui/charts";
import { worldMap } from "@jcsoftdev/ui/charts/maps/data/world";
import { Chip } from "@jcsoftdev/ui/atoms";
import { Tile, TileSkeleton, useMounted } from "./bento";

const orders: ChoroplethDatum[] = (
  [
    ["PER", 5200],
    ["BRA", 780],
    ["CHL", 1360],
    ["COL", 910],
    ["ARG", 640],
    ["ECU", 520],
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
  ] as const
).map(([id, value]) => ({ id, value }));

const cities: MapPoint[] = [
  { id: "lim", name: "Lima", lat: -12.05, lon: -77.04, value: 5200, category: "Sudamérica" },
  { id: "scl", name: "Santiago", lat: -33.45, lon: -70.67, value: 1360, category: "Sudamérica" },
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
  { id: "r6", from: "lim", to: "scl", value: 1360, name: "Lima → Santiago" },
];

export default function GlobeTile() {
  const mounted = useMounted();
  return (
    <Tile
      title="Globe with routes"
      subtitle="Drag, or use the arrow keys"
      cols={2}
      rows={4}
      index={1}
      aside={<Chip tone="accent">SVG</Chip>}
    >
      {mounted ? (
        <GlobeChart
          height="fill"
          title="Pedidos por país"
          map={worldMap}
          data={orders}
          points={cities}
          routes={routes}
          valueName="Pedidos"
          valueFormat="integer"
          autoRotate
          autoRotateSpeed={6}
          initialRotation={{ lon: 70, lat: -12 }}
          legend={false}
          labels={{
            empty: "Sin datos",
            value: "Pedidos",
            noData: "Sin datos",
            resetView: "Vista inicial",
            pauseSpin: "Pausar giro",
            playSpin: "Girar",
          }}
        />
      ) : (
        <TileSkeleton label="globe" />
      )}
    </Tile>
  );
}
