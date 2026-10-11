import { useState } from "react";
import { Avatar } from "../atoms/avatar/index.js";
import { Button } from "../atoms/button/index.js";
import { Chip } from "../atoms/chip/index.js";
import { Progress } from "../atoms/progress/index.js";
import { Switch } from "../atoms/switch/index.js";
import { Carousel } from "../containers/carousel/index.js";
import { FileTree, type FileTreeNode } from "../containers/file-tree/index.js";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "../containers/resizable/index.js";
import { AccentPicker } from "../forms/accent-picker/index.js";
import { Input } from "../forms/input/index.js";
import { Select } from "../forms/select/index.js";
import { Textarea } from "../forms/textarea/index.js";
import { Plus, Scissors, Trash2 } from "../icons/index.js";
import { Segmented, SegmentedItem } from "../navigation/segmented/index.js";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../overlays/dialog/index.js";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../overlays/hover-card/index.js";
import { BentoGrid, Tile, useOverlayContainer } from "./bento.js";
import { AssistantTile, BookingTile, NoteTile, TuningTile } from "./kit-tiles.js";

const acentos = [
  { value: "coral", label: "Coral", swatch: "var(--pal-coral-fill, #faa2a2)" },
  { value: "durazno", label: "Durazno", swatch: "var(--pal-durazno-fill)" },
  { value: "menta", label: "Menta", swatch: "var(--pal-menta-fill)" },
  { value: "cielo", label: "Cielo", swatch: "var(--pal-cielo-fill)" },
  { value: "lavanda", label: "Lavanda", swatch: "var(--pal-lavanda-fill)" },
];

const servicios = [
  { nombre: "Corte clásico", precio: "S/ 35", detalle: "Tijera y máquina, 30 min" },
  { nombre: "Perfilado de barba", precio: "S/ 25", detalle: "Con toalla caliente, 20 min" },
  { nombre: "Corte + barba", precio: "S/ 55", detalle: "El combo más pedido, 50 min" },
  { nombre: "Fade degradado", precio: "S/ 40", detalle: "Alto, medio o bajo, 35 min" },
  { nombre: "Tinte de barba", precio: "S/ 45", detalle: "Cubre canas, 40 min" },
];

const archivos: FileTreeNode[] = [
  {
    id: "clientes",
    name: "Clientes",
    children: [
      { id: "lista", name: "lista-clientes.csv" },
      {
        id: "fotos",
        name: "Fotos de cortes",
        children: [
          { id: "f1", name: "degradado-luis.jpg" },
          { id: "f2", name: "barba-marco.png" },
        ],
      },
      { id: "notas", name: "notas-de-estilo.md" },
    ],
  },
  {
    id: "finanzas",
    name: "Finanzas",
    children: [
      { id: "ingresos", name: "ingresos-octubre.csv" },
      { id: "yape", name: "reporte-yape.pdf" },
    ],
  },
  { id: "inventario", name: "inventario.json" },
];

function Panel({ title, children }: { title: string; children: string }) {
  return (
    <div className="flex h-full flex-col gap-1 overflow-auto p-card">
      <h4 className="m-0 text-ink text-row-title">{title}</h4>
      <p className="m-0 text-ink-2 text-meta">{children}</p>
    </div>
  );
}

function Stack({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-w-0 flex-col justify-center gap-density-sm">{children}</div>
  );
}

/** Controls bento: the interactive kit, every control live. */
export function ControlsBento() {
  const container = useOverlayContainer();
  const [acento, setAcento] = useState("coral");
  const [reservas, setReservas] = useState(true);
  const [recordatorios, setRecordatorios] = useState(false);
  return (
    <BentoGrid rowHeight={120}>
      <Tile title="Botones" subtitle="Variantes y tamaños" cols={2} rows={2} index={0}>
        <Stack>
          <div className="flex flex-wrap items-center gap-density-sm">
            <Button variant="primary">
              <Plus aria-hidden="true" /> Nueva cita
            </Button>
            <Button>Reagendar</Button>
            <Button variant="ghost">Cancelar</Button>
            <Button variant="danger">
              <Trash2 aria-hidden="true" /> Anular
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-density-sm">
            <Button size="sm" variant="primary">
              Cobrar S/ 55
            </Button>
            <Button size="sm">Ver ficha</Button>
            <Button size="sm" variant="ghost">
              Notas
            </Button>
            <Button size="sm" disabled>
              Sin stock
            </Button>
          </div>
        </Stack>
      </Tile>

      <Tile title="Vista de agenda" subtitle="Segmented y switches" cols={2} rows={2} index={1}>
        <Stack>
          <Segmented aria-label="Vista de agenda" defaultValue="semana">
            <SegmentedItem value="dia">Día</SegmentedItem>
            <SegmentedItem value="semana">Semana</SegmentedItem>
            <SegmentedItem value="mes">Mes</SegmentedItem>
          </Segmented>
          <div className="flex items-center justify-between gap-density text-body text-ink">
            Reservas en línea
            <Switch
              aria-label="Reservas en línea"
              checked={reservas}
              onCheckedChange={setReservas}
            />
          </div>
          <div className="flex items-center justify-between gap-density text-body text-ink">
            Recordatorio por WhatsApp
            <Switch
              aria-label="Recordatorio por WhatsApp"
              checked={recordatorios}
              onCheckedChange={setRecordatorios}
            />
          </div>
          <Progress value={68} aria-label="Meta mensual" />
        </Stack>
      </Tile>

      <Tile title="Nuevo cliente" subtitle="Campos de formulario" cols={2} rows={3} index={2}>
        <Stack>
          <Input aria-label="Nombre del cliente" placeholder="Ej. Marco Salazar" />
          <Input aria-label="Teléfono" type="tel" placeholder="987 654 321" />
          <Select aria-label="Barbero preferido" defaultValue="">
            <option value="">Elige un barbero</option>
            <option value="diego">Diego Quispe</option>
            <option value="ana">Ana Torres</option>
            <option value="marco">Marco Rojas</option>
          </Select>
          <Textarea aria-label="Notas de estilo" rows={2} placeholder="Notas de estilo" />
        </Stack>
      </Tile>

      <Tile
        title="Servicios destacados"
        subtitle="Carrusel con puntos y flechas"
        cols={4}
        rows={2}
        index={3}
      >
        <Carousel label="Servicios destacados" showDots showArrows>
          {servicios.map((servicio) => (
            <article
              key={servicio.nombre}
              className="flex h-full flex-col justify-between rounded-card border-card p-card shadow-card surface-card"
            >
              <div>
                <h4 className="m-0 text-card-title text-ink">{servicio.nombre}</h4>
                <p className="m-0 text-ink-3 text-meta">{servicio.detalle}</p>
              </div>
              <span className="text-kpi-number text-ink">{servicio.precio}</span>
            </article>
          ))}
        </Carousel>
      </Tile>

      <Tile title="Etiquetas" subtitle="Chips y tonos" cols={2} rows={1} index={4}>
        <div className="flex flex-wrap content-center items-center gap-density-sm">
          <Chip>Corte</Chip>
          <Chip tone="accent">Degradado</Chip>
          <Chip tone="success">Confirmada</Chip>
          <Chip tone="warning">Por confirmar</Chip>
          <Chip tone="danger">No asistió</Chip>
          <Chip tone="outline">VIP</Chip>
        </div>
      </Tile>

      <Tile title="Archivos" subtitle="Árbol navegable" cols={2} rows={3} index={6}>
        <FileTree
          nodes={archivos}
          label="Archivos de la barbería"
          defaultExpandedIds={["clientes"]}
          defaultSelectedId="lista"
        />
      </Tile>

      <Tile title="Paneles" subtitle="Arrastra las barras" cols={4} rows={3} index={7} flush>
        <ResizablePanelGroup direction="horizontal" aria-label="Agenda" className="h-full">
          <ResizablePanel defaultSize={28} minSize={18} maxSize={45}>
            <Panel title="Barberos">Diego Quispe, Ana Torres y Marco Rojas.</Panel>
          </ResizablePanel>
          <ResizableHandle label="Redimensionar lista de barberos" />
          <ResizablePanel defaultSize={44} minSize={25}>
            <Panel title="Agenda del día">
              Siete citas hoy. Arrastra la barra o usa las flechas del teclado.
            </Panel>
          </ResizablePanel>
          <ResizableHandle label="Redimensionar detalle" />
          <ResizablePanel minSize={18}>
            <Panel title="Detalle">Corte clásico para Luis Ramírez, S/ 35.</Panel>
          </ResizablePanel>
        </ResizablePanelGroup>
      </Tile>

      <Tile
        title="Color de la barbería"
        subtitle="Acento local de la selección"
        cols={4}
        rows={1}
        index={5}
      >
        <div className="flex h-full items-center justify-between gap-density">
          <AccentPicker
            aria-label="Color de la barbería"
            options={acentos}
            value={acento}
            onValueChange={setAcento}
          />
          <Chip tone="accent">{acento}</Chip>
        </div>
      </Tile>

      <Tile title="Diálogo" subtitle="Se abre sobre la página" cols={1} rows={1} index={8}>
        <div className="flex h-full items-center">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="danger">Anular cita</Button>
            </DialogTrigger>
            <DialogContent closeLabel="Cerrar" container={container}>
              <DialogHeader>
                <DialogTitle>Anular cita</DialogTitle>
              </DialogHeader>
              <DialogBody>
                <p className="m-0 text-[13px] text-ink-2">
                  Vas a anular la cita de Luis Ramírez (Corte + barba, sábado 11:30 con Diego
                  Quispe). El horario quedará libre.
                </p>
              </DialogBody>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="ghost">Volver</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button variant="danger" className="ml-auto">
                    Anular cita
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </Tile>

      <Tile title="Ficha rápida" subtitle="Pasa el cursor" cols={1} rows={1} index={9}>
        <div className="flex h-full items-center gap-density-sm">
          <Scissors aria-hidden="true" className="size-4 text-ink-3" />
          <HoverCard>
            <HoverCardTrigger asChild>
              <a
                href="#diego"
                className="rounded-chip font-semibold text-accent-ink underline underline-offset-2 focus-visible:focus-ring"
              >
                @diego.quispe
              </a>
            </HoverCardTrigger>
            <HoverCardContent container={container}>
              <div className="flex gap-density">
                <Avatar name="Diego Quispe" size="lg" />
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-ink text-row-title">Diego Quispe</span>
                  <span className="text-ink-3 text-meta">Barbero senior desde 2019</span>
                  <div className="flex flex-wrap gap-density-sm pt-1">
                    <Chip tone="accent">Degradados</Chip>
                    <Chip tone="success">Disponible hoy</Chip>
                  </div>
                </div>
              </div>
            </HoverCardContent>
          </HoverCard>
        </div>
      </Tile>
      <BookingTile index={10} />
      <TuningTile index={11} />
      <AssistantTile index={12} />
      <NoteTile index={13} />
    </BentoGrid>
  );
}
