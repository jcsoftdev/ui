import type { Meta, StoryObj } from "@storybook/react-vite";
import { useRef, useState } from "react";
import { Boxes, CalendarDays, LayoutDashboard, Scissors, Users } from "../icons/index.js";
import { AppShell } from "../shell/app-shell/index.js";
import { Sidebar, type SidebarGroup } from "../shell/sidebar/index.js";
import { Topbar } from "../shell/topbar/index.js";
import { InicioDashboard } from "./inicio-dashboard.js";
import { NARROW_NOTE, narrowFrame, TABLET_NOTE, tabletFrame } from "./layout.js";

const navGroups: SidebarGroup[] = [
  {
    id: "operacion",
    label: "Operación",
    items: [
      { id: "inicio", label: "Inicio", href: "#inicio", icon: <LayoutDashboard />, active: true },
      { id: "agenda", label: "Agenda", href: "#agenda", icon: <CalendarDays />, badge: 12 },
      { id: "clientes", label: "Clientes", href: "#clientes", icon: <Users /> },
    ],
  },
  {
    id: "negocio",
    label: "Negocio",
    items: [
      { id: "servicios", label: "Servicios", href: "#servicios", icon: <Scissors /> },
      { id: "inventario", label: "Inventario", href: "#inventario", icon: <Boxes />, badge: 4 },
    ],
  },
];

/** The dashboard inside the app shell: the sidebar becomes a drawer under 900 px of shell width. */
function InicioWithShell() {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    menuButton.current?.focus();
  };
  return (
    <AppShell className="h-full">
      <Sidebar
        ariaLabel="Navegación principal"
        groups={navGroups}
        open={open}
        onClose={close}
        className="!h-full"
        header={<strong className="px-2 text-card-title">Barbería Don Lucho</strong>}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <Topbar
          breadcrumbs={["Operación", "Inicio"]}
          breadcrumbsLabel="Ruta de navegación"
          menuButtonRef={menuButton}
          onOpenMenu={() => setOpen(true)}
          menuLabel="Abrir menú"
          onSearch={() => {}}
          searchLabel="Buscar"
          searchPlaceholder="Cliente, teléfono o servicio"
        />
        <div className="@container/page p-4 @min-[900px]/app:p-7">
          <InicioDashboard />
        </div>
      </div>
    </AppShell>
  );
}

const meta = {
  title: "Dashboards/Inicio",
  component: InicioDashboard,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Pantalla de inicio del dueño de la barbería: KPIs, ingresos de 30 días, mezcla de servicios, ocupación por hora, ventas por barbero y próximas citas. Todo se adapta al ancho del contenedor: usa la barra de herramientas Contenedor (320, 480, 768) o arrastra el marco.",
      },
    },
  },
} satisfies Meta<typeof InicioDashboard>;

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

/** Sidebar fixed at the side; the container is wide enough. */
export const WithShell: Story = {
  render: () => <InicioWithShell />,
  parameters: { a11y: { test: "todo" }, layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="h-[760px] overflow-hidden [transform:translateZ(0)]">
        <Story />
      </div>
    ),
  ],
};

/** 375 px container: the shell turns the sidebar into a drawer and the topbar shows the menu button, whatever the viewport is. */
export const WithShellNarrow: Story = {
  render: () => <InicioWithShell />,
  parameters: { a11y: { test: "todo" }, layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="h-[700px] w-[375px] max-w-full overflow-hidden border border-line [transform:translateZ(0)]">
        <Story />
      </div>
    ),
  ],
};
