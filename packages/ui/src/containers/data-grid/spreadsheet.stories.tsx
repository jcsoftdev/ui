import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { type Venta, ventaColumns, ventas } from "./data-grid.fixtures.js";
import { DataGrid } from "./data-grid.js";
import {
  ChartsDemo,
  diagnosticoColumns,
  diagnosticos,
  ExportXlsxDemo,
  FormulasDemo,
  lineaColumns,
  lineas,
  type SheetControls,
  SparklineDemo,
  UndoRedoDemo,
} from "./spreadsheet.demos.js";

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

const formulaHint =
  "Las columnas llevan letra (A, B, C…) y las filas siguen el orden de los datos. Selecciona una celda para ver su fórmula en la barra; escribe = para empezar una; Ctrl + D copia hacia abajo ajustando las referencias.";

function Formulas(args: ControlArgs) {
  return (
    <FormulasDemo
      {...controls(args)}
      rows={lineas}
      columns={lineaColumns}
      label="Presupuesto de servicios con fórmulas"
      hint={formulaHint}
    />
  );
}

export const FormulasPresupuesto: Story = {
  name: "Formulas",
  render: (args) => <Formulas {...args} />,
};

export const FormulasNarrow: Story = {
  name: "Formulas (320 px)",
  decorators: [narrow],
  render: (args) => <Formulas {...args} />,
};

export const FormulasPreset: Story = {
  name: "Formulas (elevated preset)",
  decorators: [
    (Story) => (
      <section data-style="elevated">
        <Story />
      </section>
    ),
  ],
  render: (args) => <Formulas {...args} />,
};

export const FormulaErrors: Story = {
  name: "Formula errors",
  render: (args) => (
    <FormulasDemo
      {...controls(args)}
      rows={diagnosticos}
      columns={diagnosticoColumns}
      label="Errores de fórmula"
      hint="#DIV/0!, #NAME?, #REF!, #VALUE! y #CYCLE! se muestran en rojo; un error se propaga a las fórmulas que lo leen."
    />
  ),
};

export const ExportXlsx: Story = {
  name: "Export XLSX",
  render: (args) => <ExportXlsxDemo {...controls(args)} />,
};

export const ExportXlsxNarrow: Story = {
  name: "Export XLSX (320 px)",
  decorators: [narrow],
  render: (args) => <ExportXlsxDemo {...controls(args)} />,
};

export const ExportXlsxPreset: Story = {
  name: "Export XLSX (glass preset)",
  decorators: [
    (Story) => (
      <section data-style="glass">
        <Story />
      </section>
    ),
  ],
  render: (args) => <ExportXlsxDemo {...controls(args)} />,
};

export const IntegratedCharts: Story = {
  name: "Integrated charts",
  render: (args) => <ChartsDemo {...controls(args)} />,
};

export const IntegratedChartsNarrow: Story = {
  name: "Integrated charts (320 px)",
  decorators: [narrow],
  render: (args) => <ChartsDemo {...controls(args)} />,
};

export const IntegratedChartsPreset: Story = {
  name: "Integrated charts (flat preset)",
  decorators: [
    (Story) => (
      <section data-style="flat">
        <Story />
      </section>
    ),
  ],
  render: (args) => <ChartsDemo {...controls(args)} />,
};

export const SparklineColumn: Story = {
  name: "Sparkline column",
  render: (args) => <SparklineDemo {...controls(args)} />,
};

export const SparklineColumnNarrow: Story = {
  name: "Sparkline column (320 px)",
  decorators: [narrow],
  render: (args) => <SparklineDemo {...controls(args)} />,
};
