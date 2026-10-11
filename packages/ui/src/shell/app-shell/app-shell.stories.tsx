import type { Meta, StoryObj } from "@storybook/react-vite";
import { CalendarDays, Scissors, Users } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button } from "../../atoms/button/index.js";
import { Sidebar, type SidebarGroup } from "../sidebar/index.js";
import { Topbar } from "../topbar/index.js";
import { AppShell, useAppShell } from "./app-shell.js";

const groups: SidebarGroup[] = [
  {
    id: "operacion",
    label: "Operación",
    items: [
      { id: "agenda", label: "Agenda", href: "#agenda", icon: <CalendarDays />, active: true },
      { id: "clientes", label: "Clientes", href: "#clientes", icon: <Users /> },
      { id: "servicios", label: "Servicios", href: "#servicios", icon: <Scissors /> },
    ],
  },
];

function Mode() {
  const shell = useAppShell();
  return (
    <p className="text-ink-3 text-meta">
      Modo del shell: {shell?.compact ? "compacto (menú en cajón)" : "ancho (menú fijo)"}
    </p>
  );
}

function ShellDemo({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <AppShell className={className}>
      <Sidebar
        groups={groups}
        ariaLabel="Navegación principal"
        header={<div className="px-2.5 font-bold text-ink">Barbería Don Lucho</div>}
        open={open}
        onClose={() => setOpen(false)}
      />
      <div className="min-w-0 flex-1 bg-bg">
        <Topbar
          breadcrumbs={["Barbería", "Agenda", "Hoy"]}
          breadcrumbsLabel="Ruta de navegación"
          menuLabel="Abrir menú"
          onOpenMenu={() => setOpen(true)}
          onSearch={() => {}}
          searchLabel="Buscar"
          searchPlaceholder="Buscar cliente, cita o producto"
          actions={<Button size="sm">Nueva cita</Button>}
        />
        <main className="p-7 text-ink">
          <h1 className="font-bold text-lg">Agenda de hoy</h1>
          <p className="text-ink-3 text-meta">12 citas - S/ 840 estimados</p>
          <Mode />
        </main>
      </div>
    </AppShell>
  );
}

/** Frame that contains the fixed sidebar and gives the shell a real height. */
function Frame({ children, width }: { children: ReactNode; width?: number }) {
  return (
    <div
      className="h-[560px] overflow-hidden [transform:translateZ(0)]"
      style={width ? { width, maxWidth: "100%" } : undefined}
    >
      {children}
    </div>
  );
}

const meta = {
  title: "Shell/AppShell",
  component: AppShell,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: { children: null },
  argTypes: {
    className: { control: "text" },
    children: { control: false },
  },
} satisfies Meta<typeof AppShell>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Wide container: the sidebar is always visible next to the page. */
export const Default: Story = {
  parameters: { a11y: { test: "todo" } },
  render: (args) => (
    <Frame>
      <ShellDemo className={args.className} />
    </Frame>
  ),
};

/** 375 px wrapper: under 900 px of container width the sidebar becomes a drawer opened from the menu button. */
export const Compact: Story = {
  render: (args) => (
    <Frame width={375}>
      <ShellDemo className={args.className} />
    </Frame>
  ),
};
