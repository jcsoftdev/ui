import { StatusPill } from "@jcsoftdev/ui/atoms";
import { type CalendarEvent, WeekView } from "@jcsoftdev/ui/calendar";
import { Tile, TileSkeleton, useMounted } from "./bento";

const events: CalendarEvent[] = [
  {
    id: "e1",
    date: "2026-10-05",
    start: "10:00",
    end: "10:30",
    title: "José Carrasco · Corte clásico",
    subtitle: "Diego Quispe · S/ 35",
    tone: "success",
    srLabel: "Atendida:",
  },
  {
    id: "e2",
    date: "2026-10-05",
    start: "11:00",
    end: "11:50",
    title: "Marco Salas · Corte + barba",
    subtitle: "Marco Rojas · S/ 55",
    tone: "success",
    srLabel: "Atendida:",
  },
  {
    id: "e3",
    date: "2026-10-06",
    start: "10:00",
    end: "10:30",
    title: "Andrés Paredes · Perfilado",
    subtitle: "Ana Torres · S/ 25",
    tone: "danger",
    srLabel: "No asistió:",
  },
  {
    id: "e4",
    date: "2026-10-07",
    start: "15:00",
    end: "16:00",
    title: "Renzo Vega · Tinte + corte",
    subtitle: "Ana Torres · S/ 80",
    tone: "accent",
    srLabel: "Confirmada:",
  },
  {
    id: "e5",
    date: "2026-10-08",
    start: "10:00",
    end: "10:30",
    title: "Pedro León · Corte clásico",
    subtitle: "Diego Quispe · S/ 35",
    tone: "success",
    srLabel: "Atendida:",
  },
  {
    id: "e6",
    date: "2026-10-08",
    start: "10:00",
    end: "11:00",
    title: "Hugo Medina · Fade + cejas",
    subtitle: "Marco Rojas · S/ 45",
    tone: "accent",
    srLabel: "Confirmada:",
  },
  {
    id: "e7",
    date: "2026-10-08",
    start: "11:30",
    end: "12:20",
    title: "Luis Ramírez · Corte + barba",
    subtitle: "Diego Quispe · S/ 55",
    tone: "accent",
    srLabel: "Confirmada:",
  },
  {
    id: "e8",
    date: "2026-10-08",
    start: "13:00",
    end: "14:00",
    title: "Almuerzo del equipo",
    tone: "neutral",
    srLabel: "Bloqueado:",
  },
  {
    id: "e9",
    date: "2026-10-08",
    start: "16:30",
    end: "17:20",
    title: "Sergio Ortiz · Corte + barba",
    subtitle: "Rosa Salazar · S/ 55",
    tone: "warning",
    srLabel: "Por confirmar:",
  },
  {
    id: "e10",
    date: "2026-10-09",
    start: "10:30",
    end: "11:00",
    title: "Iván Cruz · Perfilado",
    subtitle: "Diego Quispe · S/ 25",
    tone: "accent",
    srLabel: "Confirmada:",
  },
  {
    id: "e11",
    date: "2026-10-09",
    start: "12:00",
    end: "12:30",
    title: "Tomás Silva · Corte niño",
    subtitle: "Rosa Salazar · S/ 25",
    tone: "warning",
    srLabel: "Por confirmar:",
  },
  {
    id: "e12",
    date: "2026-10-10",
    start: "17:00",
    end: "18:00",
    title: "Novio VIP · Paquete boda",
    subtitle: "Ana Torres · S/ 180",
    tone: "accent",
    srLabel: "Confirmada:",
  },
];

export default function CalendarTile() {
  const mounted = useMounted();
  return (
    <Tile
      title="Calendar and agenda"
      subtitle="Week view, 5 to 11 October"
      cols={4}
      rows={4}
      index={4}
      flush
      aside={<StatusPill status="success" label="Caja abierta" />}
    >
      <div className="h-full pl-card">
        {mounted ? (
          <WeekView
            className="h-full [&_[data-hours-scroll]]:h-full [&_[data-hours-scroll]]:max-h-full"
            week="2026-10-08"
            today="2026-10-08"
            currentTime="11:45"
            events={events}
            workingHours={[9, 19]}
            locale="en-GB"
            weekStartsOn={1}
            allDayLabel="Todo el día"
          />
        ) : (
          <TileSkeleton label="calendar" />
        )}
      </div>
    </Tile>
  );
}
