import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { type Venta, ventaColumns, ventas } from "./data-grid.fixtures.js";
import { DataGrid } from "./data-grid.js";
import { type SheetControls, UndoRedoDemo } from "./spreadsheet.demos.js";

type ControlArgs = SheetControls;

const meta = {
  title: "Containers/DataGrid/Spreadsheet",
  component: DataGrid<Venta>,
  tags: ["autodocs"],
  args: {
    "aria-label": "Ventas de octubre",
    data: ventas,
    columns: ventaColumns,
    height: 420,
    density: "normal",
  },
  argTypes: {
    density: { control: "inline-radio", options: ["compact", "normal", "comfortable"] },
    height: { control: { type: "number", min: 160, step: 40 } },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Funciones de hoja de cálculo de DataGrid: historial de cambios (deshacer y rehacer), fórmulas con `=`, exportación XLSX sin dependencias y gráficos integrados a partir de un rango de celdas. Cada una es opt-in.",
      },
    },
  },
} satisfies Meta<typeof DataGrid<Venta>>;

export default meta;
type Story = StoryObj<typeof meta>;

const controls = (args: ControlArgs): ControlArgs => ({
  density: args.density,
  height: args.height,
});

const narrow = (Story: () => ReactNode) => (
  <div style={{ width: 320 }}>
    <Story />
  </div>
);
const preset = (Story: () => ReactNode) => (
  <section data-style="bordered">
    <Story />
  </section>
);

export const UndoRedo: Story = {
  name: "Undo / redo",
  render: (args) => <UndoRedoDemo {...controls(args)} />,
};

export const UndoRedoNarrow: Story = {
  name: "Undo / redo (320 px)",
  decorators: [narrow],
  render: (args) => <UndoRedoDemo {...controls(args)} />,
};

export const UndoRedoPreset: Story = {
  name: "Undo / redo (bordered preset)",
  decorators: [preset],
  render: (args) => <UndoRedoDemo {...controls(args)} />,
};
