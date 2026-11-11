import { renderToStaticMarkup } from "react-dom/server";
import { AreaChart } from "../../src/charts/area-chart/area-chart.js";
import { BubbleChart } from "../../src/charts/bubble-chart/bubble-chart.js";
import { BulletChart } from "../../src/charts/bullet-chart/bullet-chart.js";
import { ChartGrid } from "../../src/charts/chart-grid/chart-grid.js";
import { ChordChart } from "../../src/charts/chord-chart/chord-chart.js";
import { ComboChart } from "../../src/charts/combo-chart/combo-chart.js";
import { DonutChart } from "../../src/charts/donut-chart/donut-chart.js";
import { DumbbellChart } from "../../src/charts/dumbbell-chart/dumbbell-chart.js";
import { FillGaugeChart } from "../../src/charts/fill-gauge-chart/fill-gauge-chart.js";
import { FunnelChart } from "../../src/charts/funnel-chart/funnel-chart.js";
import { GaugeChart } from "../../src/charts/gauge-chart/gauge-chart.js";
import { Histogram } from "../../src/charts/histogram/histogram.js";
import { LineChart } from "../../src/charts/line-chart/line-chart.js";
import { PieChart } from "../../src/charts/pie-chart/pie-chart.js";
import { ScatterChart } from "../../src/charts/scatter-chart/scatter-chart.js";
import { Sparkline } from "../../src/charts/sparkline/sparkline.js";

const categories = ["Mon", "Tue"];
const series = [{ id: "a", name: "Orders", data: [3, 5] }];
const points = [
  { x: 1, y: 2, size: 4 },
  { x: 2, y: 3, size: 6 },
];
const xySeries = [{ id: "a", name: "Tables", points }];
const slices = [
  { id: "a", name: "Dine in", value: 3 },
  { id: "b", name: "Delivery", value: 5 },
];

export const charts = {
  BulletChart: () =>
    renderToStaticMarkup(
      <BulletChart title="KPIs" items={[{ label: "Revenue", actual: 8, target: 10, ranges: [5, 8, 12] }]} />,
    ),
  ChordChart: () =>
    renderToStaticMarkup(
      <ChordChart
        title="Switches"
        groups={[{ id: "a", name: "Kevin" }, { id: "b", name: "Renzo" }]}
        matrix={[[0, 3], [2, 0]]}
      />,
    ),
  DumbbellChart: () =>
    renderToStaticMarkup(
      <DumbbellChart title="Bookings" items={[{ label: "Cut", from: 3, to: 5 }]} fromLabel="Last" toLabel="This" />,
    ),
  FillGaugeChart: () =>
    renderToStaticMarkup(
      <FillGaugeChart title="Stock" data={[{ id: "a", name: "Shampoo", value: 3, max: 6 }]} />,
    ),
  FunnelChart: () => renderToStaticMarkup(<FunnelChart title="Funnel" stages={slices} />),
  GaugeChart: () => renderToStaticMarkup(<GaugeChart title="Occupancy" label="Occupancy" value={60} />),
  Histogram: () =>
    renderToStaticMarkup(
      <Histogram title="Tickets" series={[{ id: "a", name: "Ticket", values: [1, 2, 2, 3, 5, 8] }]} />,
    ),
  AreaChart: () => renderToStaticMarkup(<AreaChart title="Orders" categories={categories} series={series} />),
  BubbleChart: () => renderToStaticMarkup(<BubbleChart title="Tables" series={xySeries} />),
  ChartGrid: () =>
    renderToStaticMarkup(
      <ChartGrid title="Orders" panels={[{ id: "p", title: "Panel" }]}>
        {() => <LineChart title="Orders" categories={categories} series={series} />}
      </ChartGrid>,
    ),
  ComboChart: () =>
    renderToStaticMarkup(
      <ComboChart
        title="Orders"
        categories={categories}
        series={[{ ...series[0], type: "column" }]}
      />,
    ),
  DonutChart: () => renderToStaticMarkup(<DonutChart title="Channels" data={slices} />),
  LineChart: () => renderToStaticMarkup(<LineChart title="Orders" categories={categories} series={series} />),
  PieChart: () => renderToStaticMarkup(<PieChart title="Channels" data={slices} />),
  ScatterChart: () => renderToStaticMarkup(<ScatterChart title="Tables" series={xySeries} />),
  Sparkline: () => renderToStaticMarkup(<Sparkline data={[1, 3]} label="Orders over two days" />),
};
