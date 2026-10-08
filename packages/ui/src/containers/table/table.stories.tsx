import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Chip } from "../../atoms/chip/chip.js";
import {
  type PinnedColumns,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableLinkRow,
  TableRow,
} from "./table.js";

const inventory = [
  { sku: "POM-001", name: "Pomada mate Hombre Fuerte", stock: 24, price: "S/ 38", low: false },
  { sku: "CER-014", name: "Cera brillo clásica", stock: 9, price: "S/ 32", low: true },
  { sku: "ACE-007", name: "Aceite para barba", stock: 31, price: "S/ 45", low: false },
  { sku: "NAV-003", name: "Navajas desechables (caja)", stock: 4, price: "S/ 28", low: true },
  { sku: "SHA-021", name: "Shampoo para barba", stock: 17, price: "S/ 30", low: false },
];

const meta = {
  title: "Containers/Table",
  component: Table,
  tags: ["autodocs"],
  args: {
    "aria-label": "Inventario de productos",
    children: (
      <>
        <TableHead>
          <tr>
            <TableHeaderCell>Producto</TableHeaderCell>
            <TableHeaderCell>SKU</TableHeaderCell>
            <TableHeaderCell alignRight>Stock</TableHeaderCell>
            <TableHeaderCell alignRight>Precio</TableHeaderCell>
          </tr>
        </TableHead>
        <TableBody>
          {inventory.map((item) => (
            <TableRow key={item.sku}>
              <TableCell>
                {item.name} {item.low ? <Chip tone="danger">Stock bajo</Chip> : null}
              </TableCell>
              <TableCell>{item.sku}</TableCell>
              <TableCell alignRight>{item.stock}</TableCell>
              <TableCell alignRight>{item.price}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </>
    ),
  },
  argTypes: { children: { control: false } },
  decorators: [
    (Story) => (
      <div className="max-w-3xl rounded-lg border border-line bg-surface">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LinkRows: Story = {
  args: {
    "aria-label": "Clientes recientes",
    children: (
      <>
        <TableHead>
          <tr>
            <TableHeaderCell>Cliente</TableHeaderCell>
            <TableHeaderCell>Último servicio</TableHeaderCell>
            <TableHeaderCell alignRight>Total</TableHeaderCell>
          </tr>
        </TableHead>
        <TableBody>
          <TableLinkRow href="#luis-ramirez" primary="Luis Ramírez">
            <TableCell>Corte + barba</TableCell>
            <TableCell alignRight>S/ 45</TableCell>
          </TableLinkRow>
          <TableLinkRow href="#jose-carrasco" primary="José Carrasco">
            <TableCell>Corte clásico</TableCell>
            <TableCell alignRight>S/ 25</TableCell>
          </TableLinkRow>
          <TableLinkRow href="#marco-salas" primary="Marco Salas">
            <TableCell>Perfilado de barba</TableCell>
            <TableCell alignRight>S/ 20</TableCell>
          </TableLinkRow>
        </TableBody>
      </>
    ),
  },
};

export const Empty: Story = {
  args: {
    "aria-label": "Ventas del día",
    children: (
      <>
        <TableHead>
          <tr>
            <TableHeaderCell>Venta</TableHeaderCell>
            <TableHeaderCell alignRight>Monto</TableHeaderCell>
          </tr>
        </TableHead>
        <TableBody>
          <TableRow>
            <TableCell colSpan={2} className="py-8 text-center text-ink-3">
              Aún no hay ventas registradas hoy.
            </TableCell>
          </TableRow>
        </TableBody>
      </>
    ),
  },
};

const wide = [
  {
    id: "POM-001",
    name: "Pomada mate Hombre Fuerte",
    brand: "Hombre Fuerte",
    stock: 24,
    min: 10,
    cost: "S/ 22",
    price: "S/ 38",
    supplier: "Distribuidora Lima",
  },
  {
    id: "CER-014",
    name: "Cera brillo clásica",
    brand: "Barber Co.",
    stock: 9,
    min: 12,
    cost: "S/ 18",
    price: "S/ 32",
    supplier: "Importadora Sur",
  },
  {
    id: "ACE-007",
    name: "Aceite para barba",
    brand: "Barba Real",
    stock: 31,
    min: 8,
    cost: "S/ 27",
    price: "S/ 45",
    supplier: "Distribuidora Lima",
  },
  {
    id: "NAV-003",
    name: "Navajas desechables (caja)",
    brand: "Shave Pro",
    stock: 4,
    min: 6,
    cost: "S/ 15",
    price: "S/ 28",
    supplier: "Insumos Perú",
  },
];

function WideTable(props: {
  pinnedColumns?: PinnedColumns;
  defaultPinnedColumns?: PinnedColumns;
  pinStorageKey?: string;
  onPinnedColumnsChange?: (pinned: PinnedColumns) => void;
  pinnable?: boolean;
}) {
  const { pinnable, ...tableProps } = props;
  return (
    <Table aria-label="Inventario completo" className="min-w-[960px]" {...tableProps}>
      <TableHead>
        <tr>
          <TableHeaderCell columnId="name" pinnable={pinnable}>
            Producto
          </TableHeaderCell>
          <TableHeaderCell columnId="id" pinnable={pinnable}>
            SKU
          </TableHeaderCell>
          <TableHeaderCell columnId="brand" pinnable={pinnable}>
            Marca
          </TableHeaderCell>
          <TableHeaderCell columnId="supplier" pinnable={pinnable}>
            Proveedor
          </TableHeaderCell>
          <TableHeaderCell columnId="stock" alignRight pinnable={pinnable}>
            Stock
          </TableHeaderCell>
          <TableHeaderCell columnId="min" alignRight pinnable={pinnable}>
            Mínimo
          </TableHeaderCell>
          <TableHeaderCell columnId="cost" alignRight pinnable={pinnable}>
            Costo
          </TableHeaderCell>
          <TableHeaderCell columnId="price" alignRight pinnable={pinnable}>
            Precio
          </TableHeaderCell>
          <TableHeaderCell columnId="actions">Acciones</TableHeaderCell>
        </tr>
      </TableHead>
      <TableBody>
        {wide.map((item) => (
          <TableRow key={item.id}>
            <TableCell columnId="name">{item.name}</TableCell>
            <TableCell columnId="id">{item.id}</TableCell>
            <TableCell columnId="brand">{item.brand}</TableCell>
            <TableCell columnId="supplier">{item.supplier}</TableCell>
            <TableCell columnId="stock" alignRight>
              {item.stock}
            </TableCell>
            <TableCell columnId="min" alignRight>
              {item.min}
            </TableCell>
            <TableCell columnId="cost" alignRight>
              {item.cost}
            </TableCell>
            <TableCell columnId="price" alignRight>
              {item.price}
            </TableCell>
            <TableCell columnId="actions">
              <button type="button" className="text-accent-ink">
                Editar
              </button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Producto pinned left and acciones pinned right: the middle columns scroll under them. */
export const PinnedLeftAndRight: Story = {
  name: "PinnedColumns",
  render: () => <WideTable pinnedColumns={{ left: ["name"], right: ["actions"] }} />,
};

/** Uncontrolled: use the pin buttons in the headers; the choice is remembered in localStorage. */
export const UserPinning: Story = {
  render: () => (
    <WideTable
      pinnable
      pinStorageKey="ui-story-table-pins"
      defaultPinnedColumns={{ left: ["name"] }}
    />
  ),
};

/** Controlled pins, with the current value shown below. */
export const ControlledPinning: Story = {
  render: function Render() {
    const [pins, setPins] = useState<PinnedColumns>({ left: ["name"], right: ["price"] });
    return (
      <div className="flex flex-col gap-2">
        <WideTable pinnable pinnedColumns={pins} onPinnedColumnsChange={setPins} />
        <code className="px-2 pb-2 text-meta text-ink-3">{JSON.stringify(pins)}</code>
      </div>
    );
  },
};

/** 320 px container: the table scrolls inside its wrapper and the pinned columns stay put. */
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="@container/page w-[320px] max-w-full">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <WideTable pinnable defaultPinnedColumns={{ left: ["name"], right: ["actions"] }} />
  ),
};
