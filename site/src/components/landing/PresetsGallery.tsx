import { Avatar, Button, Chip, Progress, StatusPill } from "@jcsoftdev/ui/atoms";
import { Kpi } from "@jcsoftdev/ui/containers";

const PRESETS = [
  { id: "soft", note: "Rounded, quiet shadows" },
  { id: "bordered", note: "Hairlines, no shadows" },
  { id: "elevated", note: "Layered depth" },
  { id: "flat", note: "No borders, no shadows" },
  { id: "glass", note: "Translucent, blurred" },
  { id: "brutal", note: "Hard edges, offset shadow" },
] as const;

/** The same markup under each preset: rendered on the server, no JavaScript, each card sets only `data-style`. */
export default function PresetsGallery() {
  return (
    <div className="grid gap-density sm:grid-cols-2 lg:grid-cols-3">
      {PRESETS.map((preset) => (
        <div key={preset.id} data-style={preset.id} className="presets-cell rounded-card p-card">
          <article className="flex min-w-0 flex-col gap-density rounded-card border-card p-card shadow-card surface-card">
            <header className="flex items-center justify-between gap-density-sm">
              <div>
                <h3 className="m-0 text-card-title text-ink">{preset.id}</h3>
                <p className="m-0 text-ink-3 text-meta">{preset.note}</p>
              </div>
              <Chip tone="accent">data-style</Chip>
            </header>
            <div className="flex items-center gap-density-sm">
              <Avatar name="Diego Quispe" />
              <div className="min-w-0 flex-1">
                <p className="m-0 truncate text-ink text-row-title">Diego Quispe</p>
                <p className="m-0 truncate text-ink-3 text-meta">16:00 · Corte + barba</p>
              </div>
              <StatusPill status="success" label="Confirmada" />
            </div>
            <Kpi label="Ingresos de hoy" value="S/ 1 240" description="+12% vs. ayer" />
            <Progress value={72} aria-label={`Ocupación en el estilo ${preset.id}`} />
            <div className="flex flex-wrap gap-density-sm">
              <Button variant="primary">Reservar</Button>
              <Button>Cancelar</Button>
            </div>
          </article>
        </div>
      ))}
    </div>
  );
}
