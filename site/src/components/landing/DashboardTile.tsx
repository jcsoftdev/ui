import { Chip } from "@jcsoftdev/ui/atoms";
import { AreaChart, DonutChart, Sparkline } from "@jcsoftdev/ui/charts";
import { KpiGroup } from "@jcsoftdev/ui/containers";
import { Tile, TileSkeleton, useMounted } from "./bento";
import { ingresos, kpis, meta, serviciosIngreso, ventasSemana } from "./data";

export default function DashboardTile() {
  const mounted = useMounted();
  return (
    <Tile
      title="Revenue dashboard"
      subtitle="KPIs and charts that fill their container"
      cols={4}
      rows={4}
      index={0}
      aside={<Chip tone="success">Meta superada</Chip>}
    >
      {mounted ? (
        <div className="grid h-full min-h-0 grid-rows-[auto_1fr] gap-density">
          <KpiGroup items={kpis} className="[&>dl]:h-auto" />
          <div className="grid min-h-0 grid-cols-1 gap-density @min-[640px]/tile:grid-cols-[1.6fr_1fr]">
            <AreaChart
              height="fill"
              title="Ingresos diarios de los últimos 30 días"
              categories={ingresos.map((i) => i.fecha)}
              series={[
                { id: "ingresos", name: "Ingresos", data: ingresos.map((i) => i.ingresos) },
                { id: "meta", name: "Meta", data: meta },
              ]}
              valueFormat="currency"
              legend="top"
              labels={{ empty: "Sin datos", category: "Día", value: "Ingresos" }}
            />
            <div className="hidden min-h-0 flex-col gap-density @min-[640px]/tile:flex">
              <div className="min-h-0 flex-1">
                <DonutChart
                  height="fill"
                  title="Ingresos por servicio"
                  data={serviciosIngreso}
                  valueFormat="currency"
                  centerLabel="Total del mes"
                  labels={{ total: "Total" }}
                />
              </div>
              <div className="h-12 shrink-0">
                <Sparkline
                  data={ventasSemana}
                  label="Ventas diarias de las últimas dos semanas"
                  type="bar"
                  height="fill"
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <TileSkeleton label="dashboard" />
      )}
    </Tile>
  );
}
