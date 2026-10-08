import { DataGrid, type CellChange, type DataGridColumn } from "@jcsoftdev/ui/containers";
import { useCallback, useState } from "react";
import { useMounted } from "./bento";

interface Linea {
  id: string;
  concepto: string;
  cantidad: number | string;
  precio: number | string;
  subtotal: number | string;
  igv: number | string;
  total: number | string;
  nota: number | string;
}

const productos: Array<[string, number, number]> = [
  ["Corte clásico", 40, 35],
  ["Corte + barba", 22, 55],
  ["Perfilado de barba", 18, 25],
  ["Fade degradado", 15, 40],
  ["Afeitado con navaja", 9, 30],
  ["Tinte de barba", 6, 45],
  ["Cera para peinar", 12, 28],
];

const lineas: Linea[] = [
  ...productos.map(([concepto, cantidad, precio], index) => {
    const row = index + 1;
    return {
      id: `L-${row}`,
      concepto,
      cantidad,
      precio,
      subtotal: `=B${row}*C${row}`,
      igv: `=ROUND(D${row}*0.18,2)`,
      total: `=D${row}+E${row}`,
      nota: `=IF(F${row}>1000,"Alto","Normal")`,
    };
  }),
  {
    id: "L-8",
    concepto: "Totales",
    cantidad: "=SUM(B1:B7)",
    precio: "=AVERAGE(C1:C7)",
    subtotal: "=SUM(D1:D7)",
    igv: "=SUM(E1:E7)",
    total: "=SUM(F1:F7)",
    nota: '=IF(F8>5000,"Meta superada","Bajo la meta")',
  },
];

const editable = { editable: true, resizable: true } as const;
const columns: DataGridColumn<Linea>[] = [
  { id: "concepto", header: "Concepto", accessor: "concepto", width: 180, ...editable },
  { id: "cantidad", header: "Cant.", accessor: "cantidad", type: "number", width: 92, ...editable },
  { id: "precio", header: "Precio", accessor: "precio", type: "currency", width: 112, ...editable },
  {
    id: "subtotal",
    header: "Subtotal",
    accessor: "subtotal",
    type: "currency",
    width: 120,
    ...editable,
  },
  { id: "igv", header: "IGV", accessor: "igv", type: "currency", width: 108, ...editable },
  { id: "total", header: "Total", accessor: "total", type: "currency", width: 124, ...editable },
  { id: "nota", header: "Nota", accessor: "nota", width: 150, ...editable },
];

/** A spreadsheet: type `=` to write a formula, Ctrl+Z to undo, export to XLSX. */
export default function GridShowcase() {
  const mounted = useMounted();
  const [rows, setRows] = useState<Linea[]>(lineas);
  const apply = useCallback((changes: readonly CellChange<Linea>[]) => {
    setRows((previous) =>
      previous.map((row) => {
        const patch = changes.filter((c) => c.rowId === row.id);
        return patch.length
          ? { ...row, ...Object.fromEntries(patch.map((c) => [c.columnId, c.value])) }
          : row;
      }),
    );
  }, []);
  if (!mounted) return <div className="h-[420px]" aria-hidden="true" />;
  return (
    <DataGrid
      aria-label="Presupuesto de servicios con fórmulas"
      data={rows}
      columns={columns}
      getRowId={(row) => row.id}
      height={420}
      formulas
      history
      rangeSelection
      exportXlsx="presupuesto.xlsx"
      hideToolbar={false}
      onCellChange={(change) => apply([change])}
      onCellsChange={apply}
    />
  );
}
