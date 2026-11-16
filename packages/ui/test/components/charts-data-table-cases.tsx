import { renderToStaticMarkup } from "react-dom/server";
import * as C from "../../src/charts/index.js";
import { peruMap } from "../../src/charts/maps/data/peru/index.js";
import { worldMap } from "../../src/charts/maps/data/world/index.js";

const categories = ["Mon", "Tue"];
const dates = [new Date(2026, 0, 5), new Date(2026, 0, 6)];
const series = [{ id: "a", name: "Orders", data: [3, 5] }];
const xySeries = [
  {
    id: "a",
    name: "Tables",
    points: [
      { x: 1, y: 2, size: 4 },
      { x: 2, y: 3, size: 6 },
    ],
  },
];
const slices = [
  { id: "a", name: "Dine in", value: 3 },
  { id: "b", name: "Delivery", value: 5 },
];
const tree = {
  id: "root",
  name: "Sales",
  children: [
    { id: "a", name: "Cuts", value: 3 },
    { id: "b", name: "Beards", value: 5 },
  ],
};
const distribution = [
  {
    id: "a",
    name: "Wait",
    data: [
      [1, 2, 3, 4, 5],
      [2, 3, 4, 5, 9],
    ],
  },
];
const heat = {
  rows: ["Mon", "Tue"],
  columns: ["09:00", "10:00"],
  values: [
    [1, 2],
    [3, 4],
  ],
};
const bars = [
  { date: dates[0] as Date, open: 1, high: 4, low: 1, close: 3, volume: 10 },
  { date: dates[1] as Date, open: 3, high: 6, low: 2, close: 5, volume: 12 },
];
const choropleth = [
  { id: "PE-LMA", value: 2400 },
  { id: "PE-ARE", value: 760 },
];
const crossfilterRecords = [
  { channel: "Dine in", ticket: 20 },
  { channel: "Delivery", ticket: 35 },
  { channel: "Dine in", ticket: 28 },
];
const crossfilterDimensions = {
  channel: (record: (typeof crossfilterRecords)[number]) => record.channel,
  ticket: (record: (typeof crossfilterRecords)[number]) => record.ticket,
};

const render = (element: React.ReactElement) => () => renderToStaticMarkup(element);

const inCrossfilter = (chart: React.ReactElement) =>
  render(
    <C.CrossfilterProvider data={crossfilterRecords} dimensions={crossfilterDimensions}>
      {chart}
    </C.CrossfilterProvider>,
  );

export const charts: Record<string, () => string> = {
  AlluvialChart: render(
    <C.AlluvialChart
      title="Flow"
      stages={["Before", "After"]}
      categories={[
        { id: "a", name: "Kevin" },
        { id: "b", name: "Renzo" },
      ]}
      flows={[
        [
          { from: "a", to: "b", value: 2 },
          { from: "b", to: "a", value: 3 },
        ],
      ]}
    />,
  ),
  AreaChart: render(<C.AreaChart title="Orders" categories={categories} series={series} />),
  BarChart: render(<C.BarChart title="Orders" categories={categories} series={series} />),
  BarRaceChart: render(
    <C.BarRaceChart
      title="Race"
      entities={[
        { id: "a", name: "Kevin" },
        { id: "b", name: "Renzo" },
      ]}
      frames={[
        { label: "May", values: [3, 5] },
        { label: "Jun", values: [6, 4] },
      ]}
    />,
  ),
  BeeswarmChart: render(
    <C.BeeswarmChart
      title="Waits"
      series={[
        {
          id: "a",
          name: "Wait",
          points: [
            { value: 3, category: "Kevin" },
            { value: 5, category: "Renzo" },
          ],
        },
      ]}
    />,
  ),
  BoxPlot: render(<C.BoxPlot title="Waits" categories={categories} series={distribution} />),
  BubbleChart: render(<C.BubbleChart title="Tables" series={xySeries} />),
  BubbleMap: render(
    <C.BubbleMap
      title="Branches"
      map={peruMap}
      points={[{ id: "a", name: "Lima", lon: -77, lat: -12, value: 3 }]}
    />,
  ),
  BulletChart: render(
    <C.BulletChart
      title="KPIs"
      items={[{ label: "Revenue", actual: 8, target: 10, ranges: [5, 8, 12] }]}
    />,
  ),
  CalendarHeatmap: render(
    <C.CalendarHeatmap
      title="Visits"
      days={[
        { date: dates[0] as Date, value: 3 },
        { date: dates[1] as Date, value: 5 },
      ]}
    />,
  ),
  CandlestickChart: render(
    <C.CandlestickChart
      title="Cash"
      data={[
        { date: "Mon", open: 1, high: 4, low: 1, close: 3 },
        { date: "Tue", open: 3, high: 6, low: 2, close: 5 },
      ]}
    />,
  ),
  CartesianChart: render(
    <C.CartesianChart
      title="Orders"
      categories={categories}
      series={[{ ...(series[0] as (typeof series)[number]), kind: "line" }]}
    />,
  ),
  ChartGrid: render(
    <C.ChartGrid title="Orders" panels={[{ id: "p", title: "Panel" }]}>
      {() => <C.LineChart title="Orders" categories={categories} series={series} />}
    </C.ChartGrid>,
  ),
  ChordChart: render(
    <C.ChordChart
      title="Switches"
      groups={[
        { id: "a", name: "Kevin" },
        { id: "b", name: "Renzo" },
      ]}
      matrix={[
        [0, 3],
        [2, 0],
      ]}
    />,
  ),
  ChoroplethDrilldown: render(
    <C.ChoroplethDrilldown
      title="Customers"
      root={{ id: "pe", name: "Peru", map: peruMap, data: choropleth }}
      resolve={() => undefined}
    />,
  ),
  ChoroplethMap: render(<C.ChoroplethMap title="Customers" map={peruMap} data={choropleth} />),
  ComboChart: render(
    <C.ComboChart
      title="Orders"
      categories={categories}
      series={[{ ...(series[0] as (typeof series)[number]), type: "column" }]}
    />,
  ),
  CrossfilterBarChart: inCrossfilter(<C.CrossfilterBarChart title="Channels" dimension="channel" />),
  CrossfilterHistogram: inCrossfilter(
    <C.CrossfilterHistogram title="Tickets" dimension="ticket" />,
  ),
  CrossfilterScatter: inCrossfilter(
    <C.CrossfilterScatter title="Tickets" x="ticket" y="ticket" />,
  ),
  DonutChart: render(<C.DonutChart title="Channels" data={slices} />),
  DrilldownBarChart: render(<C.DrilldownBarChart title="Sales" data={tree} />),
  DrilldownHeatmap: render(<C.DrilldownHeatmap title="Occupancy" root={{ name: "Week", ...heat }} />),
  DumbbellChart: render(
    <C.DumbbellChart
      title="Bookings"
      items={[{ label: "Cut", from: 3, to: 5 }]}
      fromLabel="Last"
      toLabel="This"
    />,
  ),
  FillGaugeChart: render(
    <C.FillGaugeChart title="Stock" data={[{ id: "a", name: "Shampoo", value: 3, max: 6 }]} />,
  ),
  FunnelChart: render(<C.FunnelChart title="Funnel" stages={slices} />),
  GanttChart: render(
    <C.GanttChart
      title="Remodel"
      tasks={[
        { id: "a", name: "Plan", start: dates[0] as Date, end: dates[1] as Date },
        { id: "b", name: "Build", start: dates[1] as Date, end: new Date(2026, 0, 9) },
      ]}
    />,
  ),
  GaugeChart: render(<C.GaugeChart title="Occupancy" label="Occupancy" value={60} />),
  GlobeChart: render(<C.GlobeChart title="Reach" map={worldMap} data={[{ id: "PE", value: 3 }]} />),
  HeatmapChart: render(<C.HeatmapChart title="Occupancy" {...heat} />),
  HexTileMap: render(<C.HexTileMap title="Customers" data={choropleth} />),
  HierarchyMorph: render(<C.HierarchyMorph title="Sales" data={tree} />),
  Histogram: render(
    <C.Histogram
      title="Tickets"
      series={[{ id: "a", name: "Ticket", values: [1, 2, 2, 3, 5, 8] }]}
    />,
  ),
  IcicleChart: render(<C.IcicleChart title="Sales" data={tree} />),
  IsotypeRows: render(<C.IsotypeRows title="Visits" data={slices} />),
  LineChart: render(<C.LineChart title="Orders" categories={categories} series={series} />),
  LineDrilldown: render(<C.LineDrilldown title="Sales" data={tree} />),
  LollipopChart: render(
    <C.LollipopChart
      title="Services"
      items={[
        { label: "Cut", value: 3 },
        { label: "Beard", value: 5 },
      ]}
    />,
  ),
  ParliamentChart: render(<C.ParliamentChart title="Seats" data={slices} />),
  PictogramChart: render(<C.PictogramChart title="Visits" data={slices} />),
  PieChart: render(<C.PieChart title="Channels" data={slices} />),
  PolarAreaChart: render(<C.PolarAreaChart title="Channels" data={slices} />),
  ProgressUnits: render(<C.ProgressUnits label="Goal" value={3} />),
  RadarChart: render(<C.RadarChart title="Skills" axes={["Cut", "Beard", "Color"]} series={[{ id: "a", name: "Kevin", data: [3, 5, 4] }]} />),
  RadialBarChart: render(<C.RadialBarChart title="Goals" data={slices} />),
  RaincloudChart: render(
    <C.RaincloudChart title="Waits" categories={categories} series={distribution} />,
  ),
  RangeAreaChart: render(
    <C.RangeAreaChart
      title="Temperature"
      categories={categories}
      bands={[{ id: "a", name: "Range", min: [1, 2], max: [4, 5] }]}
    />,
  ),
  SankeyChart: render(
    <C.SankeyChart
      title="Flow"
      nodes={[
        { id: "a", name: "Web" },
        { id: "b", name: "Booked" },
      ]}
      links={[{ source: "a", target: "b", value: 3 }]}
    />,
  ),
  ScatterChart: render(<C.ScatterChart title="Tables" series={xySeries} />),
  SlopeChart: render(
    <C.SlopeChart
      title="Rank"
      items={[
        { label: "Cut", from: 3, to: 5 },
        { label: "Beard", from: 5, to: 2 },
      ]}
    />,
  ),
  Sparkline: render(<C.Sparkline data={[1, 3]} label="Orders over two days" />),
  StockChart: render(<C.StockChart title="Price" data={bars} />),
  StreamGraph: render(<C.StreamGraph title="Mix" categories={categories} series={series} />),
  SunburstChart: render(<C.SunburstChart title="Sales" data={tree} />),
  TimelineChart: render(
    <C.TimelineChart
      title="Shifts"
      rows={[{ id: "r", label: "Kevin" }]}
      items={[{ id: "i", rowId: "r", start: dates[0] as Date, end: dates[1] as Date }]}
    />,
  ),
  TreeChart: render(<C.TreeChart title="Org" data={{ id: "r", name: "Owner" }} />),
  TreemapChart: render(<C.TreemapChart title="Sales" data={tree} />),
  ViolinChart: render(<C.ViolinChart title="Waits" categories={categories} series={distribution} />),
  WaffleChart: render(<C.WaffleChart title="Visits" data={slices} />),
  WaterfallChart: render(
    <C.WaterfallChart
      title="Cash"
      steps={[
        { label: "Start", value: 5, type: "start" },
        { label: "Sales", value: 3 },
        { label: "End", type: "total" },
      ]}
    />,
  ),
};

export const excluded: readonly string[] = [
  "BoxStatsTable",
  "CategoryGroupAxis",
  "CategorySlider",
  "ChartBreadcrumb",
  "ChartBrush",
  "ChartDataTable",
  "ChartEmpty",
  "ChartFrame",
  "ChartInkToolbar",
  "ChartLegend",
  "ChartPatternDefs",
  "ChartSkeleton",
  "ChartSyncProvider",
  "ChartSyncStore",
  "ChartTooltip",
  "CrossfilterProvider",
  "CrossfilterSummary",
  "ExportMenu",
  "HierarchyHeader",
  "HierarchyLegend",
  "HierarchyTable",
  "MapDataTable",
  "MapLegend",
  "MapViewport",
  "PlotExplorer",
  "PlotOverlay",
  "TreeCard",
  "TreeChip",
];

export const componentExports: readonly string[] = Object.entries(C)
  .filter(([name, value]) => /^[A-Z][a-z]/.test(name) && typeof value === "function")
  .map(([name]) => name);
