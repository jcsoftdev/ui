import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { cn } from "../../utils/cn.js";
import { tint } from "../core/color-scale.js";
import { TreeChart, type TreeLabels } from "./tree-chart.js";
import { initials, type TreeChartDatum } from "./tree-model.js";

/** Small generated avatar (no network): a colored circle with initials. */
function avatar(text: string, hue: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="hsl(${hue} 55% 46%)"/><text x="32" y="40" font-family="sans-serif" font-size="24" font-weight="700" text-anchor="middle" fill="white">${text}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Equipo de la barbería: dueño > encargados por sede > barberos. */
const team: TreeChartDatum = {
  id: "dueno",
  name: "Carlos Mendoza",
  subtitle: "Dueño",
  badge: "3 sedes",
  image: avatar("CM", 14),
  children: [
    {
      id: "miraflores",
      name: "Lucía Paredes",
      subtitle: "Encargada de sede",
      badge: "Miraflores",
      image: avatar("LP", 200),
      children: [
        { id: "kevin", name: "Kevin Rojas", subtitle: "Barbero senior", badge: "Degradados" },
        { id: "diego", name: "Diego Salas", subtitle: "Barbero", badge: "Barba" },
        { id: "andrea", name: "Andrea Quispe", subtitle: "Colorista", badge: "Color" },
        {
          id: "mateo",
          name: "Mateo Huamán",
          subtitle: "Barbero",
          children: [
            { id: "piero", name: "Piero Castillo", subtitle: "Aprendiz" },
            { id: "sofia", name: "Sofía Ramos", subtitle: "Aprendiz" },
          ],
        },
      ],
    },
    {
      id: "surco",
      name: "Jorge Vargas",
      subtitle: "Encargado de sede",
      badge: "Surco",
      children: [
        { id: "luis", name: "Luis Fernández", subtitle: "Barbero senior", badge: "Clásicos" },
        { id: "renzo", name: "Renzo Chávez", subtitle: "Barbero" },
        { id: "camila", name: "Camila Torres", subtitle: "Recepción" },
      ],
    },
    {
      id: "barranco",
      name: "Valeria Núñez",
      subtitle: "Encargada de sede",
      badge: "Barranco",
      children: [
        { id: "bruno", name: "Bruno Llanos", subtitle: "Barbero", badge: "Diseños" },
        { id: "nico", name: "Nicolás Pinto", subtitle: "Barbero" },
      ],
    },
  ],
};

const spanishLabels: Partial<TreeLabels> = {
  empty: "Todavía no hay equipo registrado",
  loading: "Cargando equipo",
  explore:
    "Equipo de la barbería. Usa las flechas para moverte entre jefe, equipo y compañeros; Enter abre o cierra; + y - para el zoom; 0 para encajar.",
  category: "Nombre",
  zoomIn: "Acercar",
  zoomOut: "Alejar",
  fit: "Encajar en la vista",
  controls: "Controles de zoom",
  zoomHint: "Arrastra para mover · Ctrl + rueda para el zoom",
  subtitle: "Cargo",
  level: "Nivel",
  parent: "Reporta a",
  children: "A cargo",
  collapsed: "cerrado",
  of: "de",
  search: "Buscar persona",
  searchPrevious: "Coincidencia anterior",
  searchNext: "Coincidencia siguiente",
  noMatches: "Sin resultados",
  groupWord: "personas más",
  descendants: "Equipo total",
  loadFailed: "No se pudo cargar. Inténtalo otra vez.",
};

/** A fourth branch whose team is fetched when you open it. */
const withLazyBranch: TreeChartDatum = {
  ...team,
  children: [
    ...(team.children ?? []),
    {
      id: "san-borja",
      name: "Rosa Camacho",
      subtitle: "Encargada de sede",
      badge: "San Borja",
      lazy: true,
      childCount: 4,
    },
  ],
};

const sanBorjaTeam: TreeChartDatum[] = [
  { id: "hector", name: "Héctor Medina", subtitle: "Barbero senior", badge: "Fade" },
  { id: "ivan", name: "Iván Soto", subtitle: "Barbero" },
  { id: "pamela", name: "Pamela Ortiz", subtitle: "Colorista", badge: "Color" },
  { id: "tomas", name: "Tomás Bravo", subtitle: "Recepción" },
];

/** A branch with many apprentices, to show leaf grouping. */
const bigBranch: TreeChartDatum = {
  ...team,
  children: [
    {
      id: "academia",
      name: "Marco Villanueva",
      subtitle: "Director de la academia",
      badge: "Academia",
      children: [
        {
          id: "inst",
          name: "Elena Ruiz",
          subtitle: "Instructora",
          children: [
            { id: "a1", name: "Aprendiz Paola" },
            { id: "a2", name: "Aprendiz Joel" },
          ],
        },
        { id: "b1", name: "Aprendiz Mauricio", subtitle: "Cohorte 1" },
        { id: "b2", name: "Aprendiz Fabiola", subtitle: "Cohorte 1" },
        { id: "b3", name: "Aprendiz Ramiro", subtitle: "Cohorte 1" },
        { id: "b4", name: "Aprendiz Alexia", subtitle: "Cohorte 2" },
        { id: "b5", name: "Aprendiz Gonzalo", subtitle: "Cohorte 2" },
        { id: "b6", name: "Aprendiz Brenda", subtitle: "Cohorte 2" },
      ],
    },
    ...(team.children ?? []),
  ],
};

const meta = {
  title: "Charts/TreeChart",
  component: TreeChart,
  tags: ["autodocs"],
  args: {
    title: "Equipo de la barbería",
    data: team,
    direction: "top",
    edgeStyle: "curved",
    height: 520,
    nodeWidth: 196,
    nodeHeight: 64,
    siblingGap: 20,
    levelGap: 56,
    collapsible: true,
    highlightPath: true,
    controls: true,
    wheelZoom: "modifier",
    animate: true,
    loading: false,
    labels: spanishLabels,
  },
  argTypes: {
    direction: { control: "inline-radio", options: ["top", "bottom", "left", "right"] },
    edgeStyle: { control: "inline-radio", options: ["curved", "step", "straight"] },
    fit: { control: "inline-radio", options: ["auto", "contain", "readable"] },
    wheelZoom: { control: "inline-radio", options: ["modifier", "always", "off"] },
    height: { control: { type: "range", min: 240, max: 760, step: 10 } },
    siblingGap: { control: { type: "range", min: 4, max: 60, step: 2 } },
    levelGap: { control: { type: "range", min: 20, max: 120, step: 4 } },
    data: { control: false },
    renderNode: { control: false },
    onNodeClick: { control: false },
    onToggle: { control: false },
  },
} satisfies Meta<typeof TreeChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { parameters: { a11y: { test: "todo" } } };

export const LeftToRight: Story = {
  parameters: { a11y: { test: "todo" } },
  args: { direction: "left", edgeStyle: "step", height: 640 },
};

export const BottomToTop: Story = {
  parameters: { a11y: { test: "todo" } },
  args: { direction: "bottom", edgeStyle: "straight" },
};

export const RightToLeft: Story = {
  parameters: { a11y: { test: "todo" } },
  args: { direction: "right", edgeStyle: "curved", height: 640 },
};

/** Only the owner and the branch managers are open; click a counter to expand a team. */
export const ExpandCollapse: Story = {
  parameters: { a11y: { test: "todo" } },
  args: { initialDepth: 2, edgeStyle: "step" },
};

/** Custom template through `renderNode`: compact vertical cards with avatar, name and role. */
export const CustomTemplate: Story = {
  parameters: { a11y: { test: "todo" } },
  args: {
    nodeWidth: 132,
    nodeHeight: 120,
    siblingGap: 14,
    renderNode: (node, state) => (
      <div
        className={cn(
          "flex h-full w-full flex-col items-center justify-center gap-1.5 rounded-card border bg-surface px-2 text-center",
          state.highlighted ? "shadow-pop" : "border-line shadow-flat",
        )}
        style={{
          borderColor: state.highlighted ? node.color : undefined,
          background: state.highlighted ? tint(node.color, 8) : undefined,
        }}
      >
        <span
          className="grid size-11 place-items-center overflow-hidden rounded-pill font-bold text-[14px] text-ink ring-2"
          style={{ background: tint(node.color, 26), ["--tw-ring-color" as string]: node.color }}
        >
          {node.image ? (
            <img src={node.image} alt="" className="size-full object-cover" />
          ) : (
            initials(node.name)
          )}
        </span>
        <span className="w-full truncate font-semibold text-[12px] text-ink">{node.name}</span>
        <span className="w-full truncate text-[10px] text-ink-3 uppercase tracking-wide">
          {node.subtitle}
        </span>
      </div>
    ),
  },
};

export const Loading: Story = {
  args: { loading: true },
};

export const Empty: Story = {
  args: { data: null },
};

/** 320 px container: `fit="auto"` keeps the cards readable and centres the root; drag to pan, the fit button shows the whole tree. */
export const Narrow: Story = {
  parameters: { a11y: { test: "todo" } },
  args: { height: 420, direction: "left", edgeStyle: "step", nodeWidth: 168, initialDepth: 2 },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};

/** Takes the exact size of a resizable parent; the view refits until you pan or zoom. */
export const FillParent: Story = {
  args: { height: "fill" },
  parameters: { a11y: { test: "todo" }, layout: "padded" },
  decorators: [
    (Story) => (
      <div
        style={{
          width: 720,
          height: 440,
          resize: "both",
          overflow: "hidden",
          outline: "1px dashed var(--line-strong)",
        }}
      >
        <Story />
      </div>
    ),
  ],
};

/** The root in the centre, one ring per level; chips replace the cards. */
export const Radial: Story = {
  parameters: { a11y: { test: "todo" } },
  args: {
    layout: "radial",
    edgeStyle: "curved",
    height: 620,
    nodeWidth: 150,
    nodeHeight: 28,
    siblingGap: 10,
    levelGap: 112,
  },
};

/** Every leaf on the last level, so the grouping of the team reads like a dendrogram. */
export const Dendrogram: Story = {
  parameters: { a11y: { test: "todo" } },
  args: {
    layout: "dendrogram",
    direction: "left",
    edgeStyle: "step",
    height: 520,
    nodeWidth: 150,
    nodeHeight: 28,
    siblingGap: 8,
    levelGap: 76,
  },
};

/** Type a name or a role: matches are ringed, Enter steps through them and pans to each, opening closed branches. */
export const Search: Story = {
  parameters: { a11y: { test: "todo" } },
  args: { searchable: true, selectable: true, initialDepth: 1, height: 520, edgeStyle: "step" },
};

/** Counters with everyone who hangs below each person. */
export const Badges: Story = {
  parameters: { a11y: { test: "todo" } },
  args: { showCounts: true, edgeStyle: "step" },
};

/** More than three apprentices under one person fold into a dashed group node. */
export const GroupedLeaves: Story = {
  parameters: { a11y: { test: "todo" } },
  args: { data: bigBranch, groupLeaves: 3, showCounts: true, initialDepth: 2, height: 560 },
};

/** Open the San Borja branch: its team loads asynchronously (1 s) and a spinner shows meanwhile. */
export const LazyChildren: Story = {
  parameters: { a11y: { test: "todo" } },
  args: { data: withLazyBranch, edgeStyle: "step", showCounts: true, fit: "contain" },
  render: function Render(args) {
    return (
      <TreeChart
        {...args}
        loadChildren={() =>
          new Promise((resolve) => {
            setTimeout(() => resolve(sanBorjaTeam), 1000);
          })
        }
      />
    );
  },
};

/** Edges colored by branch; hover a person to light the way back to the owner. */
export const EdgeColors: Story = {
  parameters: { a11y: { test: "todo" } },
  args: { edgeColor: "branch", edgeStyle: "step" },
};

export const EdgeColorsByDepth: Story = {
  parameters: { a11y: { test: "todo" } },
  args: { edgeColor: "depth", edgeStyle: "curved" },
};

/** Switch the layout and direction live: the cards glide to their new places. */
export const DynamicDirection: Story = {
  parameters: { a11y: { test: "todo" } },
  render: function Render(args) {
    const [layout, setLayout] = useState<"tidy" | "radial" | "dendrogram">("tidy");
    const [direction, setDirection] = useState<"top" | "bottom" | "left" | "right">("top");
    const pick = (
      name: string,
      options: readonly string[],
      value: string,
      set: (v: never) => void,
    ) => (
      <fieldset className="m-0 flex items-center gap-0.5 rounded-pill border-0 bg-surface-2 p-0.5">
        <legend className="sr-only">{name}</legend>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            onClick={() => set(option as never)}
            className={cn(
              "cursor-pointer rounded-pill px-3 py-1 font-semibold text-[12px]",
              value === option ? "bg-surface text-ink shadow-xs" : "text-ink-3 hover:text-ink",
            )}
          >
            {option}
          </button>
        ))}
      </fieldset>
    );
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-3">
          {pick("Layout", ["tidy", "radial", "dendrogram"], layout, setLayout)}
          {pick("Direction", ["top", "bottom", "left", "right"], direction, setDirection)}
        </div>
        <TreeChart
          {...args}
          layout={layout}
          direction={direction}
          height={560}
          nodeWidth={layout === "tidy" ? 196 : 132}
          nodeHeight={layout === "tidy" ? 64 : 28}
          siblingGap={layout === "tidy" ? 20 : 10}
          levelGap={layout === "radial" ? 112 : layout === "dendrogram" ? 76 : 56}
        />
      </div>
    );
  },
};

/** Dark theme, with search, counters and colored edges. */
export const Dark: Story = {
  parameters: { a11y: { test: "todo" } },
  globals: { theme: "dark" },
  args: { searchable: true, showCounts: true, edgeColor: "branch", edgeStyle: "step" },
};

export const RadialNarrow: Story = {
  parameters: { a11y: { test: "todo" } },
  args: {
    layout: "radial",
    height: 420,
    searchable: true,
    nodeWidth: 150,
    nodeHeight: 28,
    siblingGap: 10,
    levelGap: 112,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};
