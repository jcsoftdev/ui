import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo } from "react";
import {
  BARBEROS,
  makeVentas,
  SERVICIOS,
  type Venta,
  ventaColumns,
} from "../../containers/data-grid/data-grid.fixtures.js";
import { DataGrid } from "../../containers/data-grid/data-grid.js";
import {
  CrossfilterBarChart,
  CrossfilterHistogram,
  type CrossfilterLabels,
  CrossfilterProvider,
  type CrossfilterProviderProps,
  CrossfilterScatter,
  CrossfilterSummary,
  useCrossfilter,
} from "./crossfilter.js";
import type { Accessors } from "./crossfilter-engine.js";

const spanish: Partial<CrossfilterLabels> = {
  total: "Total",
  filtered: "Filtrado",
  excluded: "Fuera del filtro",
  count: (filtered, total) => `${filtered} de ${total}`,
  clear: "Quitar",
  clearAll: "Quitar todos los filtros",
};

const sales = makeVentas(320).filter((sale) => sale.estado !== "Anulado");

const dimensions: Accessors<Venta> = {
  barbero: (sale) => sale.barbero,
  servicio: (sale) => sale.servicio,
  hora: (sale) => sale.fecha.getHours(),
  ticket: (sale) => sale.total + sale.propina,
};

const money = (value: number) => `S/ ${Math.round(value)}`;

/** Props of the parts the default story renders, editable next to the provider's own. */
interface LayoutProps {
  columns: "wide" | "narrow";
  /** `noun` of `CrossfilterSummary`. */
  noun?: string;
  /** `bins` of the hour `CrossfilterHistogram`. */
  bins?: number;
  /** `orientation` of the service `CrossfilterBarChart`. */
  serviceOrientation?: "vertical" | "horizontal";
  /** `jitter` of `CrossfilterScatter`, in pixels. */
  jitter?: number;
}

function Layout({
  columns,
  noun = "ventas",
  bins = 11,
  serviceOrientation = "horizontal",
  jitter = 7,
}: LayoutProps) {
  const xf = useCrossfilter<Venta>();
  const rows = useMemo(() => xf.filtered.slice(), [xf.filtered]);
  return (
    <div className="@container/xf flex min-w-0 flex-col gap-4">
      <CrossfilterSummary noun={noun} labels={spanish} />
      <div
        className={
          columns === "wide"
            ? "grid grid-cols-1 gap-4 @2xl/xf:grid-cols-2"
            : "grid grid-cols-1 gap-4"
        }
      >
        <CrossfilterBarChart
          title="Ventas por barbero"
          dimension="barbero"
          keys={BARBEROS}
          height={200}
          labels={spanish}
        />
        <CrossfilterBarChart
          title="Ventas por servicio"
          dimension="servicio"
          keys={SERVICIOS.map((service) => service.name)}
          orientation={serviceOrientation}
          height={240}
          labels={spanish}
        />
        <CrossfilterHistogram
          title="Ventas por hora"
          dimension="hora"
          domain={[9, 20]}
          bins={bins}
          edgeFormat={(hour) => `${Math.round(hour)} h`}
          height={200}
          labels={spanish}
        />
        <CrossfilterScatter
          title="Hora y ticket"
          x="hora"
          y="ticket"
          jitter={jitter}
          xFormat={(hour) => `${Math.round(hour)} h`}
          yFormat={money}
          pointLabel={(sale: Venta) => `${sale.cliente} · ${sale.servicio}`}
          height={240}
          labels={spanish}
        />
      </div>
      <DataGrid<Venta>
        aria-label="Ventas filtradas"
        data={rows}
        columns={ventaColumns}
        getRowId={(sale) => sale.id}
        height={260}
      />
    </div>
  );
}

function SalesCrossfilter({ columns }: { columns: "wide" | "narrow" }) {
  return (
    <CrossfilterProvider data={sales} dimensions={dimensions}>
      <Layout columns={columns} />
    </CrossfilterProvider>
  );
}

type CrossfilterStoryArgs = CrossfilterProviderProps<unknown> & LayoutProps;

const storyArgs = {
  data: sales,
  dimensions: dimensions as unknown as Accessors<unknown>,
  children: null,
};

const meta = {
  title: "Charts/Crossfilter",
  component: CrossfilterProvider,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    columns: "wide",
    noun: "ventas",
    bins: 11,
    serviceOrientation: "horizontal",
    jitter: 7,
  },
  argTypes: {
    // Records hold `Date` values that the JSON editor would turn into strings, and the accessors are functions.
    data: { control: false },
    dimensions: { control: false },
    initialFilters: { control: "object" },
    children: { control: false },
    columns: { control: "inline-radio", options: ["wide", "narrow"] },
    noun: { control: "text" },
    bins: { control: { type: "range", min: 2, max: 22, step: 1 } },
    serviceOrientation: { control: "inline-radio", options: ["vertical", "horizontal"] },
    jitter: { control: { type: "range", min: 0, max: 16, step: 1 } },
  },
} satisfies Meta<CrossfilterStoryArgs>;

export default meta;
type Story = StoryObj<CrossfilterStoryArgs>;

/**
 * Ventas cruzadas: haz clic en una barra (barbero, servicio) o arrastra sobre las horas; los demás
 * gráficos, el contador y la tabla se recalculan. Las barras claras son el total, las de color lo
 * que dejan pasar los otros filtros.
 */
export const VentasCruzadas: Story = {
  args: storyArgs,
  render: ({ data, dimensions, initialFilters, children, ...layout }) => (
    // `initialFilters` seeds state on mount; the key remounts the provider when the control changes.
    <CrossfilterProvider
      key={JSON.stringify(initialFilters ?? null)}
      data={data}
      dimensions={dimensions}
      initialFilters={initialFilters}
    >
      <Layout {...layout} />
    </CrossfilterProvider>
  ),
};

/** Un filtro activo desde el inicio: Ana, entre las 14 y las 17 h. */
export const FiltroInicial: Story = {
  args: storyArgs,
  render: () => (
    <CrossfilterProvider
      data={sales}
      dimensions={dimensions}
      initialFilters={{
        barbero: { kind: "set", values: ["Ana"] },
        hora: { kind: "range", min: 14, max: 16.99 },
      }}
    >
      <Layout columns="wide" />
    </CrossfilterProvider>
  ),
};

/** 320 px: los gráficos se apilan y la tabla desplaza dentro de su caja. */
export const Narrow: Story = {
  args: storyArgs,
  render: () => (
    <div style={{ width: 320 }}>
      <SalesCrossfilter columns="narrow" />
    </div>
  ),
};

/** Con el preset `brutal`: bordes duros, mismos datos y mismos filtros. */
export const BrutalPreset: Story = {
  args: storyArgs,
  render: () => (
    <div data-style="brutal" className="bg-bg p-card">
      <SalesCrossfilter columns="wide" />
    </div>
  ),
};

function BrushPlot({ initial }: { initial?: boolean }) {
  return (
    <CrossfilterProvider
      data={sales}
      dimensions={dimensions}
      initialFilters={
        initial
          ? {
              hora: { kind: "range", min: 13, max: 17 },
              ticket: { kind: "range", min: 40, max: 80 },
            }
          : undefined
      }
    >
      <div className="@container/xf flex min-w-0 flex-col gap-3">
        <CrossfilterSummary noun="ventas" labels={spanish} />
        <CrossfilterScatter
          title="Hora y ticket"
          x="hora"
          y="ticket"
          xLabel="Hora"
          yLabel="Ticket"
          jitter={7}
          xFormat={(hour) => `${Math.round(hour)} h`}
          yFormat={money}
          pointLabel={(sale: Venta) => `${sale.cliente} · ${sale.servicio}`}
          height={280}
          labels={{
            ...spanish,
            brush:
              "Selección rectangular: las flechas la mueven, Mayús y flechas la redimensionan, Intro aplica y Escape quita",
          }}
        />
      </div>
    </CrossfilterProvider>
  );
}

/**
 * Pincel rectangular: arrastra sobre el gráfico para filtrar hora y ticket a la vez (un clic lo
 * quita). Con teclado, enfoca el pincel (la segunda parada de Tab): flechas mueven, Mayús + flechas
 * redimensionan, Intro aplica y Escape quita.
 */
export const PincelRectangular: Story = {
  args: storyArgs,
  render: () => <BrushPlot />,
};

/** Un rectángulo aplicado desde el inicio: de 13 a 17 h y tickets de S/ 40 a S/ 80. */
export const PincelInicial: Story = {
  args: storyArgs,
  render: () => <BrushPlot initial />,
};

/** 320 px: el pincel funciona igual en un contenedor angosto. */
export const PincelNarrow: Story = {
  args: storyArgs,
  render: () => (
    <div style={{ width: 320 }}>
      <BrushPlot initial />
    </div>
  ),
};

/**
 * Táctil: el gráfico no bloquea el scroll de la página (`touch-action: pan-x pan-y`). Mantén el dedo
 * quieto unos 350 ms (vibra al activarse) y arrastra para dibujar el rectángulo; un deslizamiento
 * normal sigue desplazando la página. Un toque corto quita el filtro. El ratón y el lápiz arrastran
 * sin espera. `touchDelay={0}` vuelve a brochar al instante y bloquea el scroll sobre el gráfico.
 */
export const PincelTactil: Story = {
  args: storyArgs,
  render: () => (
    <div style={{ width: 320 }}>
      <BrushPlot />
    </div>
  ),
};
