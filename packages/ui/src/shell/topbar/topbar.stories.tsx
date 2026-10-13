import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "../../atoms/button/index.js";
import { Bell, CalendarDays, Scissors, Users } from "../../icons/index.js";
import { Sidebar, type SidebarGroup } from "../sidebar/index.js";
import { Topbar } from "./topbar.js";

const meta = {
  title: "Shell/Topbar",
  component: Topbar,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: {
    breadcrumbs: ["Barbería", "Agenda", "Hoy"],
    breadcrumbsLabel: "Ruta de navegación",
    menuLabel: "Abrir menú",
    searchLabel: "Buscar",
    searchPlaceholder: "Buscar cliente, cita o producto",
    onSearch: () => {},
    onOpenMenu: () => {},
  },
  argTypes: {
    breadcrumbs: { control: "object" },
    breadcrumbsLabel: { control: "text" },
    menuLabel: { control: "text" },
    searchLabel: { control: "text" },
    searchPlaceholder: { control: "text" },
    onSearch: { action: "search" },
    onOpenMenu: { action: "open-menu" },
    menuButtonRef: { control: false },
    actions: { control: false },
    end: { control: false },
  },
} satisfies Meta<typeof Topbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { parameters: { a11y: { test: "todo" } } };

export const SingleCrumb: Story = {
  parameters: { a11y: { test: "todo" } },
  args: { breadcrumbs: ["Inicio"] },
};

export const WithActionsAndEnd: Story = {
  parameters: { a11y: { test: "todo" } },
  args: {
    actions: (
      <>
        <button
          type="button"
          aria-label="Notificaciones"
          className="inline-flex size-8.5 items-center justify-center rounded-control text-ink-2 hover:bg-surface-2"
        >
          <Bell className="size-4" aria-hidden="true" />
        </button>
        <Button size="sm">Nueva cita</Button>
      </>
    ),
    end: (
      <span className="inline-flex size-8.5 items-center justify-center rounded-pill bg-accent-soft font-bold text-accent-ink text-meta">
        DQ
      </span>
    ),
  },
};

export const MobileWithoutMenu: Story = {
  parameters: { viewport: { defaultViewport: "mobile1" } },
  args: { onOpenMenu: undefined },
};

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

export const PanelLayout: Story = {
  parameters: { a11y: { test: "todo" } },
  render: (args) => {
    const [open, setOpen] = useState(false);
    return (
      <div className="flex h-[560px] overflow-hidden [transform:translateZ(0)]">
        <Sidebar
          groups={groups}
          ariaLabel="Navegación principal"
          header={<div className="px-2.5 font-bold text-ink">Barbería Don Lucho</div>}
          open={open}
          onClose={() => setOpen(false)}
        />
        <div className="min-w-0 flex-1 bg-bg">
          <Topbar
            {...args}
            onOpenMenu={() => setOpen(true)}
            actions={<Button size="sm">Nueva cita</Button>}
          />
          <main className="p-7 text-ink">
            <h1 className="font-bold text-lg">Agenda de hoy</h1>
            <p className="text-ink-3 text-meta">12 citas - S/ 840 estimados</p>
          </main>
        </div>
      </div>
    );
  },
};

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="@container w-80 max-w-full">
        <Story />
      </div>
    ),
  ],
};

export const WithoutSearchOrBreadcrumbs: Story = {
  args: {
    breadcrumbs: undefined,
    breadcrumbsLabel: undefined,
    onSearch: undefined,
    searchLabel: undefined,
    searchPlaceholder: undefined,
    end: <Bell className="size-5" aria-hidden="true" />,
  },
};
