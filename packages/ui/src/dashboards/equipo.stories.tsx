import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../atoms/button/index.js";
import { BubbleMap } from "../charts/bubble-map/index.js";
import { ChoroplethMap } from "../charts/choropleth-map/index.js";
import { GanttChart, type GanttTask } from "../charts/gantt-chart/index.js";
import { peruMap } from "../charts/maps/data/peru/index.js";
import { RadarChart } from "../charts/radar-chart/index.js";
import { TreeChart } from "../charts/tree-chart/index.js";
import { Kpi } from "../containers/kpi/index.js";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderEyebrow,
  PageHeaderLede,
  PageHeaderTitle,
} from "../containers/page-header/index.js";
import {
  CardGrid,
  ChartCard,
  DashboardPage,
  KpiRow,
  NARROW_NOTE,
  narrowFrame,
  TABLET_NOTE,
  tabletFrame,
} from "./layout.js";

const organigrama = {
  name: "Lucho Ramos",
  subtitle: "Dueño",
  badge: "Central",
  children: [
    {
      name: "Diego Quispe",
      subtitle: "Jefe de sede Miraflores",
      badge: "Miraflores",
      children: [
        { name: "Ana Torres", subtitle: "Barbera senior" },
        { name: "Marco Rojas", subtitle: "Barbero" },
        { name: "Julio Paredes", subtitle: "Aprendiz" },
      ],
    },
    {
      name: "Rosa Salazar",
      subtitle: "Jefa de sede Arequipa",
      badge: "Arequipa",
      children: [
        { name: "Pedro Mamani", subtitle: "Barbero" },
        { name: "Camila Ccori", subtitle: "Barbera" },
      ],
    },
    {
      name: "Elena Vásquez",
      subtitle: "Administración",
      children: [{ name: "Raúl Campos", subtitle: "Caja y compras" }],
    },
  ],
};

const habilidades = ["Fade", "Barba", "Tinte", "Atención", "Rapidez", "Ventas"];

const textosGantt = {
  tasks: "Tareas",
  start: "Inicio",
  end: "Fin",
  progress: "Avance",
  duration: "Duración",
  milestone: "Hito",
  assignee: "Responsable",
  dependsOn: "Depende de",
  day: "día",
  days: "días",
  today: "Hoy",
  zoom: "Escala",
  zoomLevels: {
    hour: "Horas",
    day: "Días",
    week: "Semanas",
    month: "Meses",
    quarter: "Trimestres",
  },
  zoomShort: { hour: "H", day: "D", week: "S", month: "M", quarter: "T" },
  divider: "Cambiar el ancho de la lista",
  quarter: (quarter: number) => `T${quarter}`,
};

const dia = (mes: number, day: number) => new Date(2026, mes, day);
const remodelacion: GanttTask[] = [
  { id: "obra", name: "Remodelación sede San Isidro", start: dia(9, 12), end: dia(11, 19) },
  {
    id: "diseno",
    name: "Diseño y permisos",
    start: dia(9, 12),
    end: dia(9, 30),
    parentId: "obra",
    progress: 1,
    assignee: "Elena Vásquez",
  },
  {
    id: "planos",
    name: "Planos del local",
    start: dia(9, 12),
    end: dia(9, 20),
    parentId: "diseno",
    progress: 1,
  },
  {
    id: "licencia",
    name: "Licencia municipal",
    start: dia(9, 20),
    end: dia(9, 30),
    parentId: "diseno",
    progress: 1,
    dependencies: ["planos"],
  },
  {
    id: "obras",
    name: "Obra civil",
    start: dia(9, 30),
    end: dia(10, 20),
    parentId: "obra",
    progress: 0.55,
    dependencies: ["licencia"],
    assignee: "Constructora Inca",
  },
  {
    id: "pisos",
    name: "Pisos y pintura",
    start: dia(10, 20),
    end: dia(11, 4),
    parentId: "obra",
    progress: 0.1,
    dependencies: ["obras"],
  },
  {
    id: "mobiliario",
    name: "Sillones y espejos",
    start: dia(10, 24),
    end: dia(11, 10),
    parentId: "obra",
    dependencies: ["obras"],
    assignee: "Barber Supply Perú",
  },
  {
    id: "equipo",
    name: "Capacitación del equipo",
    start: dia(11, 10),
    end: dia(11, 17),
    parentId: "obra",
    dependencies: ["mobiliario"],
  },
  {
    id: "apertura",
    name: "Reapertura",
    start: dia(11, 19),
    end: dia(11, 19),
    milestone: true,
    dependencies: ["equipo", "pisos"],
  },
];

const clientesPorDepartamento = [
  { id: "PE-LMA", value: 1100 },
  { id: "PE-LIM", value: 140 },
  { id: "Arequipa", value: 410 },
  { id: "Cusco", value: 280 },
  { id: "La Libertad", value: 330 },
  { id: "Piura", value: 190 },
  { id: "Lambayeque", value: 160 },
  { id: "Junín", value: 120 },
  { id: "Ica", value: 95 },
];

const sedes = [
  { id: "mir", name: "Miraflores", lon: -77.03, lat: -12.12, value: 1240, category: "Propia" },
  { id: "sis", name: "San Isidro", lon: -77.04, lat: -12.1, value: 860, category: "Propia" },
  { id: "aqp", name: "Arequipa Centro", lon: -71.54, lat: -16.4, value: 410, category: "Propia" },
  { id: "cus", name: "Cusco", lon: -71.97, lat: -13.53, value: 280, category: "Franquicia" },
  { id: "tru", name: "Trujillo", lon: -79.03, lat: -8.11, value: 330, category: "Franquicia" },
  { id: "piu", name: "Piura", lon: -80.63, lat: -5.19, value: 190, category: "Franquicia" },
];

function EquipoDashboard() {
  return (
    <DashboardPage>
      <PageHeader>
        <div>
          <PageHeaderEyebrow>Equipo y sedes</PageHeaderEyebrow>
          <PageHeaderTitle>
            Tu gente en <span className="text-accent-word">todo el Perú</span>
          </PageHeaderTitle>
          <PageHeaderLede>
            Organigrama, habilidades, obra de la nueva sede y dónde están tus clientes.
          </PageHeaderLede>
        </div>
        <PageHeaderActions>
          <Button variant="secondary" size="sm">
            Nueva sede
          </Button>
          <Button size="sm">Invitar barbero</Button>
        </PageHeaderActions>
      </PageHeader>

      <KpiRow>
        <Kpi label="Barberos" value="9" description="2 en formación" />
        <Kpi label="Sedes" value="6" description="3 propias, 3 franquicias" />
        <Kpi label="Clientes activos" value="3 125" description="+210 este mes" />
        <Kpi label="Avance de obra" value="38%" description="Reapertura 19 de dic." />
      </KpiRow>

      <ChartCard title="Organigrama" subtitle="Quién reporta a quién" height={380}>
        <TreeChart
          height="fill"
          title="Organigrama de la barbería"
          data={organigrama}
          nodeWidth={200}
          initialDepth={2}
          labels={{ subtitle: "Cargo", parent: "Reporta a", children: "A cargo" }}
        />
      </ChartCard>

      <ChartCard
        title="Remodelación de la sede San Isidro"
        subtitle="Cronograma de octubre a diciembre"
        height={400}
      >
        <GanttChart
          height="fill"
          title="Cronograma de la remodelación de San Isidro"
          tasks={remodelacion}
          defaultZoom="week"
          today={dia(10, 3)}
          texts={textosGantt}
        />
      </ChartCard>

      <CardGrid columns={3}>
        <ChartCard title="Habilidades" subtitle="Evaluación del 1 al 10" height={360}>
          <RadarChart
            height="fill"
            title="Habilidades de los barberos"
            axes={habilidades}
            max={10}
            series={[
              { id: "diego", name: "Diego", data: [9, 8, 6, 9, 7, 8] },
              { id: "ana", name: "Ana", data: [8, 9, 8, 10, 6, 7] },
              { id: "marco", name: "Marco", data: [7, 6, 9, 8, 9, 6] },
            ]}
          />
        </ChartCard>
        <ChartCard title="Clientes por departamento" subtitle="Clientes activos" height={360}>
          <ChoroplethMap
            height="fill"
            title="Clientes activos por departamento"
            map={peruMap}
            data={clientesPorDepartamento}
            valueName="Clientes"
          />
        </ChartCard>
        <ChartCard title="Sedes" subtitle="Tamaño según clientes atendidos" height={360}>
          <BubbleMap
            height="fill"
            title="Sedes de la barbería"
            map={peruMap}
            points={sedes}
            valueName="Clientes"
            maxRadius={26}
          />
        </ChartCard>
      </CardGrid>
    </DashboardPage>
  );
}

const meta = {
  title: "Dashboards/Equipo",
  component: EquipoDashboard,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Equipo y sedes: organigrama, radar de habilidades, Gantt de la remodelación y mapas del Perú (coroplético de clientes y burbujas de sedes). Usa la barra Contenedor para revisar 320, 480 y 768.",
      },
    },
  },
} satisfies Meta<typeof EquipoDashboard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Narrow: Story = {
  decorators: [narrowFrame],
  parameters: { docs: { description: { story: NARROW_NOTE } } },
};

export const Tablet: Story = {
  decorators: [tabletFrame],
  parameters: { docs: { description: { story: TABLET_NOTE } } },
};
