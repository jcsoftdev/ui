import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Boxes, CalendarDays, LayoutDashboard, Scissors, Users } from "../../icons/index.js";
import { Sidebar, type SidebarGroup } from "./sidebar.js";

const groups: SidebarGroup[] = [
  {
    id: "operacion",
    label: "Operación",
    items: [
      { id: "inicio", label: "Inicio", href: "#inicio", icon: <LayoutDashboard />, active: true },
      {
        id: "agenda",
        label: "Agenda",
        href: "#agenda",
        icon: <CalendarDays />,
        badge: 12,
        badgeLabel: "citas hoy",
      },
      { id: "clientes", label: "Clientes", href: "#clientes", icon: <Users /> },
    ],
  },
  {
    id: "negocio",
    label: "Negocio",
    items: [
      { id: "servicios", label: "Servicios", href: "#servicios", icon: <Scissors /> },
      {
        id: "inventario",
        label: "Inventario",
        href: "#inventario",
        icon: <Boxes />,
        badge: 4,
        badgeTone: "danger",
        badgeLabel: "productos con stock bajo",
      },
    ],
  },
];

const header = <div className="px-2.5 font-bold text-ink">Barbería Don Lucho</div>;
const footer = (
  <div className="rounded-control bg-surface-2 px-2.5 py-2 text-ink-2 text-meta">
    Diego Quispe - Barbero
  </div>
);

const meta = {
  title: "Shell/Sidebar",
  component: Sidebar,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: { groups, ariaLabel: "Navegación principal", header, footer, open: false },
  argTypes: {
    groups: { control: "object" },
    ariaLabel: { control: "text" },
    open: { control: "boolean" },
    header: { control: false },
    footer: { control: false },
    renderLink: { control: false },
    onClose: { action: "close" },
  },
  decorators: [
    (Story) => (
      <div className="h-[560px] overflow-hidden [transform:translateZ(0)]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Sidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutHeaderAndFooter: Story = { args: { header: undefined, footer: undefined } };

export const CustomLink: Story = {
  args: {
    renderLink: ({ children, ...props }) => (
      <a {...props} data-custom-link>
        {children}
      </a>
    ),
  },
};

export const MobileDrawer: Story = {
  parameters: { viewport: { defaultViewport: "mobile1" } },
  render: (args) => {
    const [open, setOpen] = useState(true);
    return (
      <>
        <button
          type="button"
          className="m-4 rounded-control border border-line-control px-3 py-2 text-ink"
          onClick={() => setOpen(true)}
        >
          Abrir menú
        </button>
        <Sidebar {...args} open={open} onClose={() => setOpen(false)} />
      </>
    );
  },
};
