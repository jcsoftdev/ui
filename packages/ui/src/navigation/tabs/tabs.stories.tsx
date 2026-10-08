import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs.js";

const meta = {
  title: "Navigation/Tabs",
  component: Tabs,
  tags: ["autodocs"],
  args: { defaultValue: "citas" },
  argTypes: {
    defaultValue: { control: "inline-radio", options: ["citas", "clientes", "inventario"] },
    value: { control: false },
    orientation: { control: "inline-radio", options: ["horizontal", "vertical"] },
    activationMode: { control: "inline-radio", options: ["automatic", "manual"] },
    onValueChange: { control: false },
    children: { control: false },
  },
  render: (args) => (
    <Tabs {...args}>
      <TabsList aria-label="Secciones">
        <TabsTrigger value="citas">Citas</TabsTrigger>
        <TabsTrigger value="clientes">Clientes</TabsTrigger>
        <TabsTrigger value="inventario">Inventario</TabsTrigger>
      </TabsList>
      <TabsContent value="citas" className="p-3 text-body">
        12 citas programadas para hoy.
      </TabsContent>
      <TabsContent value="clientes" className="p-3 text-body">
        Marco Ríos, Lucho Vargas y Andrés Paredes.
      </TabsContent>
      <TabsContent value="inventario" className="p-3 text-body">
        Pomada mate, navajas y talco.
      </TabsContent>
    </Tabs>
  ),
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithCounts: Story = {
  render: (args) => (
    <Tabs {...args}>
      <TabsList aria-label="Secciones">
        <TabsTrigger value="citas" count={12}>
          Citas
        </TabsTrigger>
        <TabsTrigger value="clientes" count={248}>
          Clientes
        </TabsTrigger>
        <TabsTrigger value="inventario" count={4}>
          Inventario
        </TabsTrigger>
      </TabsList>
      <TabsContent value="citas" className="p-3 text-body">
        12 citas programadas para hoy.
      </TabsContent>
      <TabsContent value="clientes" className="p-3 text-body">
        248 clientes registrados.
      </TabsContent>
      <TabsContent value="inventario" className="p-3 text-body">
        4 productos con stock bajo.
      </TabsContent>
    </Tabs>
  ),
};

export const DisabledTab: Story = {
  render: (args) => (
    <Tabs {...args}>
      <TabsList aria-label="Secciones">
        <TabsTrigger value="citas">Citas</TabsTrigger>
        <TabsTrigger value="clientes">Clientes</TabsTrigger>
        <TabsTrigger value="inventario" disabled>
          Inventario
        </TabsTrigger>
      </TabsList>
      <TabsContent value="citas" className="p-3 text-body">
        12 citas programadas para hoy.
      </TabsContent>
      <TabsContent value="clientes" className="p-3 text-body">
        Marco Ríos, Lucho Vargas y Andrés Paredes.
      </TabsContent>
    </Tabs>
  ),
};

function ControlledDemo() {
  const [tab, setTab] = useState("clientes");
  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList aria-label="Secciones">
        <TabsTrigger value="citas">Citas</TabsTrigger>
        <TabsTrigger value="clientes">Clientes</TabsTrigger>
      </TabsList>
      <TabsContent value="citas" className="p-3 text-body">
        Agenda de Diego Quispe.
      </TabsContent>
      <TabsContent value="clientes" className="p-3 text-body">
        Historial de cortes de Marco Ríos.
      </TabsContent>
      <p className="px-3 text-ink-3 text-meta">Pestaña activa: {tab}</p>
    </Tabs>
  );
}

export const Controlled: Story = { render: () => <ControlledDemo /> };

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="@container w-80 max-w-full">
        <Story />
      </div>
    ),
  ],
};
