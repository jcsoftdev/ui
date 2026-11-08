import type { Meta, StoryObj } from "@storybook/react-vite";
import { Chip } from "../../atoms/chip/chip.js";
import { BarChart } from "../../charts/bar-chart/index.js";
import { Kpi } from "../kpi/kpi.js";
import { Page } from "../page/page.js";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "../table/table.js";
import { CardGrid, ChartCard, DashboardPage, KpiRow, TableCard } from "./dashboard.js";

const meta = {
  title: "Containers/Dashboard blocks",
  component: DashboardPage,
  subcomponents: { KpiRow, CardGrid, ChartCard, TableCard },
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <Page>
        <Story />
      </Page>
    ),
  ],
} satisfies Meta<typeof DashboardPage>;

export default meta;
type Story = StoryObj<typeof meta>;

const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun"];

function Collected() {
  return (
    <BarChart
      height="fill"
      title="Recaudación mensual"
      categories={months}
      series={[{ id: "recaudado", name: "Recaudado", data: [42, 51, 47, 58, 62, 66] }]}
    />
  );
}

interface PlaygroundArgs {
  /** `aria-label` of the `KpiRow`. */
  kpiRowLabel: string;
  /** `columns` of the `CardGrid`. */
  columns: 2 | 3;
  /** `title` of the first `ChartCard`. */
  title: string;
  /** `subtitle` of the `ChartCard`. */
  subtitle: string;
  /** `headingLevel` of the cards. */
  headingLevel: 2 | 3 | 4;
  /** `height` of the `ChartCard`, in px. */
  height: number;
  /** `title` of the `TableCard`. */
  tableTitle: string;
  /** `subtitle` of the `TableCard`. */
  tableSubtitle: string;
}

/** The props of every block from the Controls panel. */
export const Playground: StoryObj<PlaygroundArgs> = {
  args: {
    kpiRowLabel: "Cifras clave",
    columns: 2,
    title: "Recaudación",
    subtitle: "Miles de soles por mes",
    headingLevel: 2,
    height: 260,
    tableTitle: "Últimos pagos",
    tableSubtitle: "Hoy",
  },
  argTypes: {
    kpiRowLabel: { control: "text" },
    columns: { control: "inline-radio", options: [2, 3] },
    title: { control: "text" },
    subtitle: { control: "text" },
    headingLevel: { control: "inline-radio", options: [2, 3, 4] },
    height: { control: { type: "range", min: 160, max: 480, step: 20 } },
    tableTitle: { control: "text" },
    tableSubtitle: { control: "text" },
  },
  render: (args) => (
    <DashboardPage>
      <KpiRow aria-label={args.kpiRowLabel}>
        <Kpi label="Matrícula" value="1 240" description="+32 este mes" />
        <Kpi label="Recaudación" value="86%" description="Meta 90%" />
      </KpiRow>
      <CardGrid columns={args.columns}>
        {[args.title, "Morosidad", "Admisiones"].slice(0, args.columns).map((title) => (
          <ChartCard
            key={title}
            title={title}
            subtitle={args.subtitle}
            headingLevel={args.headingLevel}
            height={args.height}
          >
            <Collected />
          </ChartCard>
        ))}
      </CardGrid>
      <TableCard
        title={args.tableTitle}
        subtitle={args.tableSubtitle}
        headingLevel={args.headingLevel}
      >
        <Table>
          <TableBody>
            <TableRow>
              <TableCell>Quispe</TableCell>
              <TableCell alignRight>S/ 450</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableCard>
    </DashboardPage>
  ),
};

/** The blocks together: a named KPI row, a pair of cards and a table card. */
export const Default: Story = {
  render: () => (
    <DashboardPage>
      <KpiRow aria-label="Cifras clave">
        <Kpi label="Matrícula" value="1 240" description="+32 este mes" />
        <Kpi label="Recaudación" value="86%" description="Meta 90%" />
        <Kpi label="Morosidad" value="S/ 18 400" description="42 familias" />
        <Kpi label="Asistencia" value="94%" description="Últimos 30 días" />
      </KpiRow>
      <CardGrid columns={2}>
        <ChartCard title="Recaudación" subtitle="Miles de soles por mes" height={260}>
          <Collected />
        </ChartCard>
        <ChartCard title="Recaudación (mes)" aside={<Chip tone="success">+8%</Chip>} height={260}>
          <Collected />
        </ChartCard>
      </CardGrid>
      <TableCard title="Últimos pagos" subtitle="Hoy">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Familia</TableHeaderCell>
              <TableHeaderCell alignRight>Monto</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell>Quispe</TableCell>
              <TableCell alignRight>S/ 450</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Huamán</TableCell>
              <TableCell alignRight>S/ 380</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableCard>
    </DashboardPage>
  ),
};

/** Three columns from 1180 px of container width; two from 720 px. */
export const ThreeColumns: Story = {
  render: () => (
    <DashboardPage>
      <CardGrid columns={3}>
        {["Morosidad", "Admisiones", "Asistencia"].map((title) => (
          <ChartCard key={title} title={title} headingLevel={3} height={220}>
            <Collected />
          </ChartCard>
        ))}
      </CardGrid>
    </DashboardPage>
  ),
};

/** 320 px container: KPIs go two per row and the cards stack. */
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="@container/page w-[320px] max-w-full">
        <Story />
      </div>
    ),
  ],
  render: Default.render,
};
