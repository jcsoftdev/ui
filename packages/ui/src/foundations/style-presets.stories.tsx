import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { Button } from "../atoms/button/button.js";
import { Chip } from "../atoms/chip/chip.js";
import { BarChart } from "../charts/bar-chart/bar-chart.js";
import { Sparkline } from "../charts/sparkline/sparkline.js";
import { Card, CardBody, CardFooter, CardHeader } from "../containers/card/card.js";
import { Kpi } from "../containers/kpi/kpi.js";
import { Input } from "../forms/input/input.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../navigation/tabs/tabs.js";

const PRESETS = [
  { id: "soft", name: "Suave", note: "Filetes finos, sombras mínimas" },
  { id: "bordered", name: "Con bordes", note: "Bordes de 1 px, sin sombras" },
  { id: "elevated", name: "Elevado", note: "Sombras en capas, sin bordes" },
  { id: "flat", name: "Plano", note: "Sin bordes ni sombras, relleno teñido" },
  { id: "glass", name: "Vidrio", note: "Translúcido con desenfoque" },
  { id: "brutal", name: "Brutal", note: "Bordes gruesos, sombra dura, esquinas rectas" },
] as const;

const barbers = ["Kevin", "Renzo", "Abel", "Diego"];
const appointments = [42, 38, 51, 29];
const lastTwoWeeks = [820, 760, 910, 880, 990, 1040, 970, 1120, 1080, 1190, 1150, 1260, 1210, 1340];

/** A card that reads only the semantic tokens, the way components will after the refactor. */
function SemanticCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`min-w-0 overflow-hidden rounded-card border-card bg-surface-card shadow-card surface-card ${className}`}
    >
      {children}
    </div>
  );
}

function PresetSample({ id, name, note }: (typeof PRESETS)[number]) {
  return (
    <section
      data-style={id}
      aria-label={`Estilo ${name}`}
      className="@container/preset flex min-w-0 flex-col gap-density rounded-card bg-bg p-card text-ink"
      style={{ backgroundImage: "var(--page-backdrop)" }}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="m-0 text-card-title">{name}</h2>
        <code className="text-ink-3 text-meta">data-style="{id}"</code>
      </header>
      <p className="m-0 text-ink-2 text-meta">{note}</p>

      <div className="flex flex-wrap gap-density-sm">
        <Button variant="primary">Nueva cita</Button>
        <Button>Exportar</Button>
        <Button variant="ghost">Cancelar</Button>
      </div>

      <Input aria-label="Buscar cliente" placeholder="Buscar cliente…" />

      <div className="flex flex-wrap gap-density-sm">
        <Chip tone="accent">En atención</Chip>
        <Chip tone="success">Terminado</Chip>
        <Chip tone="outline">Sin cita</Chip>
        <Chip tone="neutral" square>
          Corte
        </Chip>
      </div>

      <Tabs defaultValue="hoy">
        <TabsList aria-label={`Periodo, estilo ${name}`}>
          <TabsTrigger value="hoy">Hoy</TabsTrigger>
          <TabsTrigger value="semana">Semana</TabsTrigger>
          <TabsTrigger value="mes">Mes</TabsTrigger>
        </TabsList>
        <TabsContent value="hoy" className="pt-2 text-body text-ink-2">
          12 citas y 3 personas en espera.
        </TabsContent>
        <TabsContent value="semana" className="pt-2 text-body text-ink-2">
          84 citas esta semana.
        </TabsContent>
        <TabsContent value="mes" className="pt-2 text-body text-ink-2">
          312 citas este mes.
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <span className="text-card-title">Cola sin cita</span>
        </CardHeader>
        <CardBody className="text-body text-ink-2">Renzo Quispe · Degradado · 15:30</CardBody>
        <CardFooter>Tarjeta actual (lee shadow-flat)</CardFooter>
      </Card>

      <SemanticCard>
        <Kpi
          className="bg-transparent"
          label="Ventas de hoy"
          value="S/ 1 340"
          description="+6 % frente a ayer"
        />
        <div className="h-10 px-[18px] pb-3">
          <Sparkline
            data={lastTwoWeeks}
            label="Ventas de los últimos 14 días"
            height="fill"
            animate={false}
          />
        </div>
      </SemanticCard>

      <SemanticCard className="p-card">
        <BarChart
          title="Citas por barbero"
          categories={barbers}
          series={[{ id: "citas", name: "Citas", data: appointments }]}
          valueFormat="integer"
          height={170}
          animate={false}
        />
      </SemanticCard>
    </section>
  );
}

function Gallery() {
  return (
    <div className="grid gap-6 @[720px]/page:grid-cols-2 @[1180px]/page:grid-cols-3">
      {PRESETS.map((p) => (
        <PresetSample key={p.id} {...p} />
      ))}
    </div>
  );
}

const meta = {
  title: "Foundations/StylePresets",
  component: Gallery,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Each column sets `data-style` on its own wrapper, so the six presets render side by side under the same theme, accent, density and radius from the toolbar. The plain `Card` still reads the legacy `shadow-flat`; the KPI and chart cards read only semantic tokens (`border-card`, `shadow-card`, `bg-surface-card`).",
      },
    },
  },
} satisfies Meta<typeof Gallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { parameters: { a11y: { test: "todo" } } };

export const Dark: Story = { globals: { theme: "dark" } };

export const Compact: Story = {
  parameters: { a11y: { test: "todo" } },
  globals: { density: "compact" },
};

export const RadiusOverride: Story = {
  parameters: { a11y: { test: "todo" } },
  globals: { radius: "full" },
};

export const Narrow: Story = {
  parameters: { a11y: { test: "todo" } },
  globals: { container: "320" },
};
