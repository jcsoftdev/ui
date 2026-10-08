import { formatNumber } from "../../charts/core/format.js";
import type { Density } from "./types.js";

/** Every visible or announced string of DataGrid (Spanish by default). */
export interface DataGridLabels {
  search: string;
  searchPlaceholder: string;
  columns: string;
  resetColumns: string;
  density: string;
  densities: Record<Density, string>;
  exportCsv: string;
  clearFilters: string;
  filtersActive: (count: number) => string;
  rowsCount: (count: number) => string;
  selectedCount: (count: number) => string;
  selectAll: string;
  selectRow: string;
  groupedBy: string;
  removeGrouping: string;
  columnMenu: (header: string) => string;
  sortAsc: string;
  sortDesc: string;
  clearSort: string;
  filter: string;
  contains: string;
  min: string;
  max: string;
  from: string;
  to: string;
  allValues: string;
  clearFilter: string;
  pinLeft: string;
  pinRight: string;
  unpin: string;
  groupBy: string;
  moveLeft: string;
  moveRight: string;
  narrower: string;
  wider: string;
  resetWidth: string;
  hide: string;
  empty: string;
  emptyFiltered: string;
  loading: string;
  total: string;
  expandGroup: string;
  collapseGroup: string;
  rowsPerPage: string;
  pageRange: (first: number, last: number, total: number) => string;
  firstPage: string;
  previousPage: string;
  nextPage: string;
  lastPage: string;
  keyboardHelp: string;
  aggregate: Record<"sum" | "avg" | "count" | "min" | "max", string>;
}

const integer = { format: (value: number) => formatNumber(value) };

export const DEFAULT_DATA_GRID_LABELS: DataGridLabels = {
  search: "Buscar en la tabla",
  searchPlaceholder: "Buscar…",
  columns: "Columnas",
  resetColumns: "Restablecer columnas",
  density: "Densidad",
  densities: { compact: "Compacta", normal: "Normal", comfortable: "Amplia" },
  exportCsv: "Exportar CSV",
  clearFilters: "Limpiar filtros",
  filtersActive: (count) => (count === 1 ? "1 filtro" : `${count} filtros`),
  rowsCount: (count) => (count === 1 ? "1 fila" : `${integer.format(count)} filas`),
  selectedCount: (count) =>
    count === 1 ? "1 seleccionada" : `${integer.format(count)} seleccionadas`,
  selectAll: "Seleccionar todas las filas",
  selectRow: "Seleccionar fila",
  groupedBy: "Agrupado por",
  removeGrouping: "Quitar agrupación",
  columnMenu: (header) => `Opciones de la columna ${header}`,
  sortAsc: "Orden ascendente",
  sortDesc: "Orden descendente",
  clearSort: "Quitar orden",
  filter: "Filtro",
  contains: "Contiene…",
  min: "Mínimo",
  max: "Máximo",
  from: "Desde",
  to: "Hasta",
  allValues: "Todos",
  clearFilter: "Limpiar filtro",
  pinLeft: "Fijar a la izquierda",
  pinRight: "Fijar a la derecha",
  unpin: "Desfijar",
  groupBy: "Agrupar por esta columna",
  moveLeft: "Mover a la izquierda",
  moveRight: "Mover a la derecha",
  narrower: "Más angosta",
  wider: "Más ancha",
  resetWidth: "Ancho original",
  hide: "Ocultar columna",
  empty: "No hay datos para mostrar.",
  emptyFiltered: "Ninguna fila coincide con la búsqueda o los filtros.",
  loading: "Cargando datos…",
  total: "Total",
  expandGroup: "Expandir grupo",
  collapseGroup: "Contraer grupo",
  rowsPerPage: "Filas por página",
  pageRange: (first, last, total) =>
    `${integer.format(first)}–${integer.format(last)} de ${integer.format(total)}`,
  firstPage: "Primera página",
  previousPage: "Página anterior",
  nextPage: "Página siguiente",
  lastPage: "Última página",
  keyboardHelp:
    "Flechas para moverte entre celdas; Inicio y Fin, Re Pág y Av Pág para saltar. En un encabezado: Enter ordena (Mayús + Enter agrega un orden), Alt + Flecha abajo abre sus opciones, Mayús + Flechas cambia el ancho y Ctrl + Mayús + Flechas la mueve. En una fila: Espacio la selecciona y Enter o F2 edita la celda.",
  aggregate: { sum: "Suma", avg: "Promedio", count: "Cantidad", min: "Mínimo", max: "Máximo" },
};
