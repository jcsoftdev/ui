import type { Meta, StoryObj } from "@storybook/react-vite";
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

export const Default: Story = {};

export const LeftToRight: Story = {
  args: { direction: "left", edgeStyle: "step", height: 640 },
};

export const BottomToTop: Story = {
  args: { direction: "bottom", edgeStyle: "straight" },
};

export const RightToLeft: Story = {
  args: { direction: "right", edgeStyle: "curved", height: 640 },
};

/** Only the owner and the branch managers are open; click a counter to expand a team. */
export const ExpandCollapse: Story = {
  args: { initialDepth: 2, edgeStyle: "step" },
};

/** Custom template through `renderNode`: compact vertical cards with avatar, name and role. */
export const CustomTemplate: Story = {
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

/** 320 px container: the whole tree is fitted at first; pinch, drag or use the buttons. */
export const Narrow: Story = {
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
  parameters: { layout: "padded" },
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
