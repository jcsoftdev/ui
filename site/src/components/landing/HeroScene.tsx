import { Avatar, Button, Chip, Progress, StatusPill, Switch } from "@jcsoftdev/ui/atoms";
import { AreaChart } from "@jcsoftdev/ui/charts";
import { Kpi } from "@jcsoftdev/ui/containers";
import { useState } from "react";
import { useMounted } from "./bento";
import { ingresos } from "./data";

const citas = [
  {
    name: "Luis Ramírez",
    service: "Corte + barba · Diego",
    time: "16:00",
    status: "success" as const,
    label: "Confirmada",
  },
  {
    name: "Marco Salazar",
    service: "Perfilado · Ana",
    time: "16:30",
    status: "warning" as const,
    label: "Pendiente",
  },
  {
    name: "Andrés Paredes",
    service: "Fade · Rosa",
    time: "17:00",
    status: "idle" as const,
    label: "En espera",
  },
];

/** A small live scene of real components. It sits next to the preset panel so every switch is visible at once. */
export default function HeroScene() {
  const mounted = useMounted();
  const [reminders, setReminders] = useState(true);
  return (
    <section
      aria-label="Live component preview"
      className="landing-glow flex min-w-0 flex-col gap-density rounded-card border-card p-card shadow-raised surface-card @container/scene"
    >
      <div className="grid grid-cols-2 gap-density">
        <Kpi label="Citas hoy" value="18" description="+4 vs. ayer" />
        <Kpi label="Ingresos" value="S/ 1 240" description="Meta S/ 1 100" />
      </div>
      <div className="h-36 min-w-0">
        {mounted ? (
          <AreaChart
            height="fill"
            title="Ingresos de los últimos 14 días"
            categories={ingresos.slice(-14).map((i) => i.fecha)}
            series={[
              {
                id: "ingresos",
                name: "Ingresos",
                data: ingresos.slice(-14).map((i) => i.ingresos),
              },
            ]}
            valueFormat="currency"
            legend={false}
            labels={{ empty: "Sin datos", category: "Día", value: "Ingresos" }}
          />
        ) : null}
      </div>
      <ul className="m-0 flex list-none flex-col gap-density-sm p-0">
        {citas.map((cita) => (
          <li key={cita.name} className="flex min-w-0 items-center gap-density-sm">
            <Avatar name={cita.name} />
            <div className="min-w-0 flex-1">
              <p className="m-0 truncate text-ink text-row-title">{cita.name}</p>
              <p className="m-0 truncate text-ink-3 text-meta">
                {cita.time} · {cita.service}
              </p>
            </div>
            <StatusPill status={cita.status} label={cita.label} />
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-density-sm">
        <Button variant="primary">Reservar corte</Button>
        <Button>Ver agenda</Button>
        <Chip tone="accent">Nuevo</Chip>
        <label className="ml-auto flex items-center gap-2 text-ink-2 text-meta">
          Recordatorios
          <Switch
            aria-label="Recordatorios por WhatsApp"
            checked={reminders}
            onCheckedChange={setReminders}
          />
        </label>
      </div>
      <Progress value={72} aria-label="Ocupación de sillas" />
    </section>
  );
}
