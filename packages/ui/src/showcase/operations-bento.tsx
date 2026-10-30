import { useState } from "react";
import { Avatar } from "../atoms/avatar/index.js";
import { AvatarGroup } from "../atoms/avatar-group/index.js";
import { Button } from "../atoms/button/index.js";
import { Chip } from "../atoms/chip/index.js";
import { Progress } from "../atoms/progress/index.js";
import { StatusPill } from "../atoms/status-pill/index.js";
import type { CalendarEvent } from "../calendar/event-block/index.js";
import { WeekView } from "../calendar/week-view/index.js";
import { ActionBar } from "../containers/action-bar/index.js";
import { DataGrid, type DataGridColumn } from "../containers/data-grid/index.js";
import { Kanban, type KanbanColumnData } from "../containers/kanban/index.js";
import { Timeline, type TimelineFeedItem } from "../containers/timeline/index.js";
import { BARBEROS, CLIENTES, SERVICIOS } from "../dashboards/data.js";
import { CalendarCheck, Package, Star, Wallet, XCircle } from "../icons/index.js";
import { BentoGrid, Tile } from "./bento.js";

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
    trailing: <Avatar name="Diego Quispe" />,
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
    start: "11:30",
    end: "12:20",
    title: "Diego Rivas · Corte + barba",
    subtitle: "Julio Paredes · S/ 55",
    tone: "accent",
    srLabel: "Confirmada:",
  },
  {
    id: "e13",
    date: "2026-10-10",
    start: "17:00",
    end: "18:00",
    title: "Novio VIP · Paquete boda",
    subtitle: "Ana Torres · S/ 180",
    tone: "accent",
    srLabel: "Confirmada:",
  },
];

const feed: TimelineFeedItem[] = [
  {
    id: "t1",
    group: "Hoy",
    title: "Cita confirmada",
    time: "14:30",
    actor: "Luis Ramírez",
    description: "Corte + barba con Diego Quispe a las 16:00.",
    icon: <CalendarCheck />,
    tone: "success",
  },
  {
    id: "t2",
    group: "Hoy",
    title: "Pago recibido por Yape",
    time: "13:05",
    actor: "Marco Salazar",
    icon: <Wallet />,
    tone: "accent",
    children: <Chip tone="success">S/ 55</Chip>,
  },
  {
    id: "t3",
    group: "Hoy",
    title: "Cita cancelada",
    time: "10:12",
    actor: "Andrés Paredes",
    description: "Avisó con 3 horas de anticipación.",
    icon: <XCircle />,
    tone: "danger",
  },
  {
    id: "t4",
    group: "Ayer",
    title: "Stock bajo: pomada mate",
    time: "18:40",
    description: "Quedan 2 unidades. Punto de reposición: 5.",
    icon: <Package />,
    tone: "warning",
  },
  {
    id: "t5",
    group: "Ayer",
    title: "Reseña de 5 estrellas",
    time: "11:20",
    actor: "Jorge Castillo",
    description: "«El mejor degradado de Miraflores.»",
    icon: <Star />,
    tone: "accent",
  },
  {
    id: "t6",
    group: "Ayer",
    title: "Pago recibido por tarjeta",
    time: "09:48",
    actor: "Bruno Mendoza",
    icon: <Wallet />,
    tone: "accent",
    children: <Chip tone="success">S/ 40</Chip>,
  },
];

const board: KanbanColumnData[] = [
  {
    id: "reservadas",
    title: "Reservadas",
    cards: [
      {
        id: "k1",
        title: "Corte clásico",
        description: "Luis Ramírez, 16:00",
        tag: "Corte",
        assignee: "Diego Quispe",
        meta: "S/ 35",
      },
      {
        id: "k2",
        title: "Perfilado de barba",
        description: "Marco Salazar, 16:30",
        tag: "Barba",
        assignee: "Diego Quispe",
        meta: "S/ 25",
      },
      {
        id: "k3",
        title: "Corte + barba",
        description: "Andrés Paredes, 17:00",
        tag: "Combo",
        assignee: "Rosa Salazar",
        meta: "S/ 55",
      },
    ],
  },
  {
    id: "en-silla",
    title: "En la silla",
    wipLimit: 2,
    cards: [
      {
        id: "k4",
        title: "Fade degradado",
        description: "Jorge Castillo",
        tag: "Corte",
        assignee: "Rosa Salazar",
        meta: "S/ 40",
      },
      {
        id: "k5",
        title: "Afeitado con navaja",
        description: "Renzo Vargas",
        tag: "Barba",
        assignee: "Diego Quispe",
        meta: "S/ 30",
      },
    ],
  },
  {
    id: "cobro",
    title: "Por cobrar",
    wipLimit: 3,
    cards: [{ id: "k6", title: "Corte infantil", description: "Mateo, 8 años", meta: "S/ 25" }],
  },
  { id: "listas", title: "Atendidas", cards: [] },
];

interface Cita {
  id: string;
  hora: string;
  cliente: string;
  servicio: string;
  barbero: string;
  estado: "Confirmada" | "Pendiente" | "En sillón";
  total: number;
}

const ESTADOS: Cita["estado"][] = ["Confirmada", "Pendiente", "En sillón"];
const citas: Cita[] = Array.from({ length: 16 }, (_, index) => {
  const servicio = SERVICIOS[index % SERVICIOS.length] ?? SERVICIOS[0];
  const minutos = 10 * 60 + index * 35;
  return {
    id: `C-${2040 + index}`,
    hora: `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`,
    cliente: CLIENTES[index % CLIENTES.length] ?? "",
    servicio: servicio.name,
    barbero: BARBEROS[index % BARBEROS.length] ?? "",
    estado: ESTADOS[index % 3] ?? "Pendiente",
    total: servicio.price,
  };
});

const columns: DataGridColumn<Cita>[] = [
  { id: "hora", header: "Hora", accessor: "hora", width: 84 },
  { id: "cliente", header: "Cliente", accessor: "cliente", width: 180 },
  { id: "servicio", header: "Servicio", accessor: "servicio", width: 170 },
  { id: "barbero", header: "Barbero", accessor: "barbero", width: 150 },
  {
    id: "estado",
    header: "Estado",
    accessor: "estado",
    type: "status",
    width: 130,
    statusTones: { Confirmada: "success", Pendiente: "warning", "En sillón": "accent" },
  },
  {
    id: "total",
    header: "Total",
    accessor: "total",
    type: "currency",
    aggregate: "sum",
    width: 100,
  },
];

const equipo = [
  {
    name: BARBEROS[0] ?? "",
    rol: "Senior",
    estado: "success" as const,
    texto: "En la silla",
    carga: 86,
  },
  {
    name: BARBEROS[1] ?? "",
    rol: "Colorista",
    estado: "success" as const,
    texto: "En la silla",
    carga: 72,
  },
  {
    name: BARBEROS[2] ?? "",
    rol: "Barbero",
    estado: "warning" as const,
    texto: "En descanso",
    carga: 55,
  },
  {
    name: BARBEROS[3] ?? "",
    rol: "Barbera",
    estado: "idle" as const,
    texto: "Fuera de turno",
    carga: 20,
  },
];

function AgendaGrid() {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <div className="relative h-full">
      <DataGrid
        aria-label="Citas de hoy"
        data={citas}
        columns={columns}
        getRowId={(cita) => cita.id}
        height={410}
        selectable
        onSelectionChange={setSelected}
        defaultPinned={{ left: ["hora"] }}
        exportFilename="citas-de-hoy"
      />
      <ActionBar
        selectedCount={selected.length}
        noun={["cita", "citas"]}
        onClear={() => setSelected([])}
        position="absolute"
      >
        <Button size="sm" variant="primary">
          Confirmar
        </Button>
        <Button size="sm" variant="danger">
          Anular
        </Button>
      </ActionBar>
    </div>
  );
}

/** Operations bento: the day of a barbershop, from agenda to the cash register. */
export function OperationsBento() {
  return (
    <BentoGrid rowHeight={120}>
      <Tile
        title="Agenda de la semana"
        subtitle="5 al 11 de octubre · Miraflores"
        cols={4}
        rows={4}
        index={0}
        flush
        aside={<StatusPill status="success" label="Caja abierta" collapseLabel />}
      >
        <div className="h-full pl-3">
          <WeekView
            className="h-full [&_[data-hours-scroll]]:h-full [&_[data-hours-scroll]]:max-h-full"
            week="2026-10-08"
            today="2026-10-08"
            currentTime="11:45"
            events={events}
            workingHours={[9, 19]}
            locale="es-PE"
            weekStartsOn={1}
            allDayLabel="Todo el día"
          />
        </div>
      </Tile>

      <Tile title="Actividad" subtitle="Pagos, citas y stock" cols={2} rows={4} index={1} flush>
        <div className="h-full overflow-auto px-card pb-card">
          <Timeline items={feed} />
        </div>
      </Tile>

      <Tile
        title="Sillones en vivo"
        subtitle="Quién está atendiendo"
        cols={2}
        rows={3}
        index={2}
        aside={
          <AvatarGroup>
            {equipo.map((barbero) => (
              <Avatar key={barbero.name} name={barbero.name} />
            ))}
          </AvatarGroup>
        }
      >
        <ul className="m-0 flex h-full list-none flex-col justify-around gap-density-sm p-0">
          {equipo.map((barbero) => (
            <li key={barbero.name} className="flex min-w-0 items-center gap-density-sm">
              <Avatar name={barbero.name} highlighted={barbero.estado === "success"} />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex min-w-0 items-center gap-density-sm">
                  <span className="truncate text-ink text-row-title">{barbero.name}</span>
                  <span className="truncate text-ink-3 text-meta">{barbero.rol}</span>
                </div>
                <Progress value={barbero.carga} aria-label={`Carga de ${barbero.name}`} />
              </div>
              <StatusPill status={barbero.estado} label={barbero.texto} collapseLabel />
            </li>
          ))}
        </ul>
      </Tile>

      <Tile
        title="Flujo del sillón"
        subtitle="Arrastra las citas entre columnas"
        cols={4}
        rows={3}
        index={3}
        flush
      >
        <div className="h-full overflow-auto px-card pb-card">
          <Kanban defaultColumns={board} emptyLabel="Sin citas" aria-label="Flujo del sillón" />
        </div>
      </Tile>

      <Tile
        title="Citas de hoy"
        subtitle="Hora fija a la izquierda; selecciona filas para actuar"
        cols={6}
        rows={4}
        index={4}
        flush
        aside={<Chip tone="accent">16 citas</Chip>}
      >
        <AgendaGrid />
      </Tile>
    </BentoGrid>
  );
}
