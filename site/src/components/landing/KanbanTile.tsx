import { Chip } from "@jcsoftdev/ui/atoms";
import { Kanban, type KanbanColumnData } from "@jcsoftdev/ui/containers";
import { Tile, TileSkeleton, useMounted } from "./bento";

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

export default function KanbanTile() {
  const mounted = useMounted();
  return (
    <Tile
      title="Kanban"
      subtitle="Drag cards, or pick them up with the keyboard"
      cols={3}
      rows={4}
      index={3}
      flush
      aside={<Chip tone="accent">Drag and drop</Chip>}
    >
      <div className="h-full overflow-auto px-card pb-card">
        {mounted ? (
          <Kanban defaultColumns={board} emptyLabel="Sin citas" aria-label="Flujo del sillón" />
        ) : (
          <TileSkeleton label="kanban" />
        )}
      </div>
    </Tile>
  );
}
