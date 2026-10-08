import type { Meta, StoryObj } from "@storybook/react-vite";
import { Chip } from "../../atoms/chip/chip.js";
import {
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
