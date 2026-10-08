import { Chip } from "@jcsoftdev/ui/atoms";
import {
  CrossfilterBarChart,
  CrossfilterHistogram,
  CrossfilterProvider,
  CrossfilterSummary,
} from "@jcsoftdev/ui/charts";
import { Tile, TileSkeleton, useMounted } from "./bento";
import { BARBEROS, SERVICIOS, seeded } from "./data";

interface Venta {
  barbero: string;
  servicio: string;
  hora: number;
  ticket: number;
}

const next = seeded(99);
const ventas: Venta[] = Array.from({ length: 260 }, () => {
  const servicio = SERVICIOS[Math.floor(next() * SERVICIOS.length)] ?? SERVICIOS[0];
  return {
    barbero: BARBEROS[Math.floor(next() * BARBEROS.length)] ?? BARBEROS[0],
    servicio: servicio.name,
    hora: 9 + Math.floor(next() * 11),
    ticket: servicio.price,
  };
});

const dimensions = {
  barbero: (v: Venta) => v.barbero,
  servicio: (v: Venta) => v.servicio,
  hora: (v: Venta) => v.hora,
};

const labels = {
  total: "Total",
  filtered: "Filtrado",
  excluded: "Fuera del filtro",
  count: (f: number, t: number) => `${f} de ${t}`,
  clear: "Quitar",
  clearAll: "Quitar todos los filtros",
};

export default function CrossfilterTile() {
  const mounted = useMounted();
  return (
    <Tile
      title="Crossfilter"
      subtitle="Click a bar or drag the hours: every chart follows"
      cols={3}
      rows={4}
      index={2}
      aside={<Chip tone="accent">Linked</Chip>}
    >
      {mounted ? (
        <CrossfilterProvider data={ventas} dimensions={dimensions}>
          <div className="@container/xf flex h-full min-h-0 flex-col gap-density-sm overflow-auto">
            <CrossfilterSummary noun="ventas" labels={labels} />
            <div className="grid grid-cols-1 gap-density @min-[420px]/xf:grid-cols-2">
              <CrossfilterBarChart
                title="Ventas por barbero"
                dimension="barbero"
                keys={BARBEROS}
                height={150}
                labels={labels}
              />
              <CrossfilterBarChart
                title="Ventas por servicio"
                dimension="servicio"
                keys={SERVICIOS.map((s) => s.name)}
                height={150}
                labels={labels}
              />
            </div>
            <CrossfilterHistogram
              title="Ventas por hora"
              dimension="hora"
              domain={[9, 20]}
              bins={11}
              edgeFormat={(h) => `${Math.round(h)} h`}
              height={150}
              labels={labels}
            />
          </div>
        </CrossfilterProvider>
      ) : (
        <TileSkeleton label="crossfilter" />
      )}
    </Tile>
  );
}
