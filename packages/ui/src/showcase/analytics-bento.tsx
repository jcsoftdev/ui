import { Chip } from "../atoms/chip/index.js";
import { NumberValue } from "../atoms/number-value/index.js";
import { TrendChip } from "../atoms/trend-chip/index.js";
import { AreaChart } from "../charts/area-chart/index.js";
import { BarChart } from "../charts/bar-chart/index.js";
import { type ChoroplethDatum, ChoroplethMap } from "../charts/choropleth-map/index.js";
import { DonutChart } from "../charts/donut-chart/index.js";
import { GaugeChart } from "../charts/gauge-chart/index.js";
import { CalendarHeatmap } from "../charts/heatmap-chart/calendar-heatmap.js";
import { peruMap } from "../charts/maps/data/peru/index.js";
import { Sparkline } from "../charts/sparkline/index.js";
import { KpiGroup, type KpiGroupItem } from "../containers/kpi-group/index.js";
import { BARBEROS, seeded } from "../dashboards/data.js";
import { cn } from "../utils/cn.js";
import { BentoGrid, columnSpan, Tile } from "./bento.js";

const random = seeded(2026);

const ingresos = Array.from({ length: 30 }, (_, index) => {
  const fecha = new Date(2026, 8, 9 + index);
  const finDeSemana = fecha.getDay() === 5 || fecha.getDay() === 6;
  const base = finDeSemana ? 1450 : 980;
  const tendencia = index * 9;
  return { fecha, ingresos: Math.round(base + tendencia + random() * 380) };
});

const meta = ingresos.map((item) => Math.round(item.ingresos * 0.9));

const servicios = [
  { id: "corte", name: "Corte clásico", value: 9800 },
  { id: "combo", name: "Corte + barba", value: 8450 },
  { id: "fade", name: "Fade degradado", value: 6200 },
  { id: "barba", name: "Perfilado de barba", value: 3100 },
  { id: "navaja", name: "Afeitado con navaja", value: 2400 },
];

const kpis: KpiGroupItem[] = [
  {
    id: "citas",
    label: "Citas atendidas",
    value: 214,
    trend: 4.1,
    trendLabel: "vs. septiembre",
  },
  {
    id: "ticket",
    label: "Ticket promedio",
    value: 47,
    format: { style: "currency", currency: "PEN", maximumFractionDigits: 0 },
    trend: 6.8,
    trendLabel: "vs. septiembre",
  },
  {
    id: "ocupacion",
    label: "Ocupación",
    value: 0.78,
    format: { style: "percent" },
    trend: -2.4,
    trendLabel: "vs. septiembre",
  },
  {
    id: "cancelaciones",
    label: "Cancelaciones",
    value: 9,
    trend: -18,
    invertTrend: true,
    trendLabel: "vs. septiembre",
  },
];

const citasPorDia = Array.from({ length: 262 }, (_, index) => {
  const date = new Date(2026, 0, 19 + index);
  const weekday = (date.getDay() + 6) % 7;
  const base = weekday === 5 ? 16 : weekday === 6 ? 4 : 9;
  return { date, value: Math.round(base + seeded(index + 7)() * 7) };
});

const ventasPorBarbero = BARBEROS.map((name, index) => ({
  name,
  total: [5820, 5310, 4680, 3990, 3230][index] ?? 0,
}));

const clientesPorDepartamento: ChoroplethDatum[] = [
  ["PE-LMA", 2400],
  ["PE-CAL", 940],
  ["PE-ARE", 760],
  ["PE-LAL", 690],
  ["PE-LIM", 610],
  ["PE-PIU", 540],
  ["PE-CUS", 520],
  ["PE-LAM", 410],
  ["PE-JUN", 380],
  ["PE-ICA", 350],
  ["PE-ANC", 310],
  ["PE-CAJ", 270],
  ["PE-PUN", 240],
  ["PE-TAC", 190],
  ["PE-LOR", 170],
  ["PE-AYA", 130],
].map(([id, value]) => ({ id: id as string, value: value as number }));

const ventasSemana = [980, 1120, 1045, 1230, 1580, 2140, 690, 1010, 1185, 1260, 1210, 1690, 2290];
const ticketSemana = [41, 43, 42, 44, 45, 44, 46, 47, 46, 48, 47, 49];
const nuevosSemana = [8, 11, 9, 14, 12, 16, 15, 19, 17, 21, 20, 24];
const cancelacionesSemana = [5, 4, 6, 3, 4, 3, 2, 3, 2, 2, 1, 2];

function MiniStat({
  title,
  value,
  format,
  trend,
  invert,
  data,
  color,
  type = "area",
  index,
}: {
  title: string;
  value: number;
  format?: Intl.NumberFormatOptions;
  trend: number;
  invert?: boolean;
  data: number[];
  color: string;
  type?: "area" | "line" | "bar";
  index: number;
}) {
  return (
    <Tile title={title} cols={2} rows={1} index={index}>
      <div className="flex h-full min-w-0 items-end gap-density">
        <div className="flex shrink-0 flex-col gap-1">
          <span className="text-kpi-number text-ink">
            <NumberValue value={value} format={format} />
          </span>
          <TrendChip value={trend} invert={invert} />
        </div>
        <div className="min-w-0 flex-1">
          <Sparkline
            data={data}
            label={title}
            type={type}
            color={color}
            height={52}
            showLast
            animate
          />
        </div>
      </div>
    </Tile>
  );
}

/** Analytics bento: revenue story first, then ranking, occupancy and geography. */
export function AnalyticsBento() {
  return (
    <BentoGrid>
      <Tile
        title="Ventas de octubre"
        subtitle="Acumulado al 8 de octubre"
        cols={2}
        rows={2}
        index={0}
        aside={<Chip tone="success">Meta superada</Chip>}
      >
        <div className="flex h-full min-w-0 flex-col justify-between gap-density">
          <div className="flex flex-col gap-1">
            <span className="text-ink font-extrabold tracking-tight text-[clamp(30px,6cqw,46px)] leading-none">
              <NumberValue
                value={48320}
                duration={1200}
                format={{ style: "currency", currency: "PEN", maximumFractionDigits: 0 }}
              />
            </span>
            <div className="pt-1">
              <TrendChip value={12.5} label="vs. septiembre" />
            </div>
          </div>
          <div className="h-16 min-w-0">
            <Sparkline
              data={ventasSemana}
              label="Ventas diarias de las últimas dos semanas"
              type="area"
              height="fill"
              valueFormat="currency"
            />
          </div>
        </div>
      </Tile>

      <KpiGroup
        items={kpis}
        className={cn(
          "bento-tile h-full min-h-0 row-span-4 @min-[480px]/bento:row-span-2 @min-[880px]/bento:row-span-1 [&>dl]:h-full",
          columnSpan(4),
        )}
      />

      <Tile
        title="Ingresos de los últimos 30 días"
        subtitle="Soles por día con la meta diaria"
        cols={4}
        rows={3}
        index={2}
        aside={<Chip tone="accent">30 días</Chip>}
      >
        <AreaChart
          height="fill"
          title="Ingresos diarios de los últimos 30 días"
          categories={ingresos.map((item) => item.fecha)}
          series={[
            { id: "ingresos", name: "Ingresos", data: ingresos.map((item) => item.ingresos) },
            { id: "meta", name: "Meta", data: meta },
          ]}
          valueFormat="currency"
          legend="top"
          annotations={[
            { type: "line", axis: "y", value: 1600, label: "Récord mensual", tone: "success" },
          ]}
          labels={{ empty: "Sin datos", category: "Día", value: "Ingresos" }}
        />
      </Tile>

      <Tile title="Ingresos por servicio" subtitle="Octubre, acumulado" cols={2} rows={2} index={3}>
        <DonutChart
          height="fill"
          title="Ingresos por servicio"
          data={servicios}
          valueFormat="currency"
          centerLabel="Total del mes"
          labels={{ total: "Total" }}
        />
      </Tile>

      <MiniStat
        title="Ticket promedio"
        value={47}
        format={{ style: "currency", currency: "PEN", maximumFractionDigits: 0 }}
        trend={6.8}
        data={ticketSemana}
        color="var(--chart-cat-1)"
        type="line"
        index={4}
      />
      <MiniStat
        title="Clientes nuevos"
        value={24}
        trend={18.2}
        data={nuevosSemana}
        color="var(--chart-cat-2)"
        type="bar"
        index={5}
      />
      <MiniStat
        title="Cancelaciones"
        value={2}
        trend={-33}
        invert
        data={cancelacionesSemana}
        color="var(--chart-cat-4)"
        index={6}
      />

      <Tile
        title="Citas por día"
        subtitle="Enero a octubre; los viernes y sábados llenan la agenda"
        cols={4}
        rows={2}
        index={7}
      >
        <CalendarHeatmap
          height="fill"
          title="Citas por día desde enero"
          days={citasPorDia}
          valueFormat="integer"
          labels={{ empty: "Sin datos", category: "Fecha", noData: "Sin datos" }}
        />
      </Tile>

      <Tile title="Ocupación de sillas" subtitle="Ahora mismo" cols={2} rows={2} index={8}>
        <GaugeChart
          height="fill"
          title="Ocupación de sillas"
          label="Ocupación de sillas"
          value={78}
          ranges={[
            { from: 0, to: 40, label: "Baja", tone: "danger" },
            { from: 40, to: 70, label: "Media", tone: "warning" },
            { from: 70, to: 100, label: "Óptima", tone: "success" },
          ]}
          valueFormat={(value: number) => `${Math.round(value)}%`}
          labels={{ empty: "Sin datos", category: "Rango", value: "Valor actual" }}
        />
      </Tile>

      <Tile
        title="Clientes por departamento"
        subtitle="Clientes que reservan desde todo el Perú"
        cols={3}
        rows={3}
        index={9}
      >
        <ChoroplethMap
          height="fill"
          title="Clientes por departamento"
          map={peruMap}
          data={clientesPorDepartamento}
          valueName="Clientes"
          valueFormat="integer"
          labels={{ empty: "Sin datos para este mapa" }}
        />
      </Tile>

      <Tile
        title="Ranking de barberos"
        subtitle="Ventas de octubre, en soles"
        cols={3}
        rows={3}
        index={10}
      >
        <BarChart
          height="fill"
          orientation="horizontal"
          title="Ventas por barbero"
          categories={ventasPorBarbero.map((item) => item.name)}
          series={[{ id: "ventas", name: "Ventas", data: ventasPorBarbero.map((i) => i.total) }]}
          valueFormat="currency"
          dataLabels
          legend={false}
        />
      </Tile>
    </BentoGrid>
  );
}
