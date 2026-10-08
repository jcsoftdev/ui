import { formatNumber } from "../../charts/core/format.js";
import type { FilterOperator } from "./filter-builder.js";
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

  // set filter
  searchValues: string;
  selectAllValues: string;
  noMatches: string;
  valuesChecked: (checked: number, total: number) => string;
  // validation
  invalidCell: string;
  // expansion, tree, details
  rowActions: string;
  expandRow: string;
  collapseRow: string;
  detailOf: (row: string) => string;
  // row pinning and reordering
  pinRowTop: string;
  pinRowBottom: string;
  unpinRow: string;
  dragRow: string;
  moveRowUp: string;
  moveRowDown: string;
  moveColumnUp: string;
  moveColumnDown: string;
  reorderBlocked: string;
  rowMoved: (row: string, position: number, total: number) => string;
  // range selection
  rangeCells: (count: number) => string;
  rangeSum: string;
  rangeAvg: string;
  rangeCount: string;
  rangeMin: string;
  rangeMax: string;
  rangeCopied: (count: number) => string;
  rangeHint: string;
  copyRange: string;
  // remote data
  loadError: string;
  retry: string;
  loadingRows: string;
  // advanced filter
  advancedFilter: string;
  addCondition: string;
  addGroup: string;
  removeNode: string;
  matchAll: string;
  matchAny: string;
  filterAnd: string;
  filterOr: string;
  filterColumn: string;
  filterOperator: string;
  filterValue: string;
  filterValueTo: string;
  filterGroupLabel: string;
  noConditions: string;
  clearAdvancedFilter: string;
  operators: Record<FilterOperator, string>;
  // tool panel and pivot
  toolPanel: string;
  panelColumns: string;
  panelRowGroups: string;
  panelPivot: string;
  pivotMode: string;
  pivotRows: string;
  pivotColumn: string;
  pivotValue: string;
  pivotAggregate: string;
  pivotIncomplete: string;
  noneOption: string;
  // export
  exportSelection: string;
  // formulas
  formulaBar: string;
  formulaCell: string;
  formulaEmpty: string;
  formulaError: string;
  // history and row tools
  history: string;
  undo: string;
  redo: string;
  addRow: string;
  removeRows: string;
  undone: (count: number) => string;
  redone: (count: number) => string;
  pasted: (count: number) => string;
  filled: (count: number) => string;
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
    "Flechas para moverte entre celdas; Inicio y Fin, Re Pág y Av Pág para saltar. En un encabezado: Enter ordena (Mayús + Enter agrega un orden), Alt + Flecha abajo abre sus opciones, Mayús + Flechas cambia el ancho y Ctrl + Mayús + Flechas la mueve. En una fila: Espacio la selecciona, Enter o F2 edita la celda, Alt + Flecha derecha o izquierda la expande o contrae, Alt + Flecha arriba o abajo la reordena y Alt + Mayús + Flecha arriba o abajo la fija. Con selección de celdas: Mayús + Flechas amplía el rango y Ctrl + C lo copia. Con historial activo: Ctrl + Z deshace y Mayús + Ctrl + Z o Ctrl + Y rehace; Ctrl + V pega y Ctrl + D o Ctrl + R rellenan hacia abajo o a la derecha. Con fórmulas, escribir = en una celda editable empieza una fórmula.",
  aggregate: { sum: "Suma", avg: "Promedio", count: "Cantidad", min: "Mínimo", max: "Máximo" },

  searchValues: "Buscar valores…",
  selectAllValues: "Seleccionar todo",
  noMatches: "Sin coincidencias",
  valuesChecked: (checked, total) => `${checked} de ${total}`,
  invalidCell: "Valor no válido",
  rowActions: "Acciones de fila",
  expandRow: "Expandir fila",
  collapseRow: "Contraer fila",
  detailOf: (row) => `Detalle de ${row}`,
  pinRowTop: "Fijar fila arriba",
  pinRowBottom: "Fijar fila abajo",
  unpinRow: "Desfijar fila",
  dragRow: "Arrastrar para reordenar",
  moveRowUp: "Subir fila",
  moveRowDown: "Bajar fila",
  moveColumnUp: "Subir columna",
  moveColumnDown: "Bajar columna",
  reorderBlocked: "Quita el orden, los filtros y la agrupación para reordenar filas.",
  rowMoved: (row, position, total) => `${row} movida a la posición ${position} de ${total}`,
  rangeCells: (count) => (count === 1 ? "1 celda" : `${integer.format(count)} celdas`),
  rangeSum: "Suma",
  rangeAvg: "Promedio",
  rangeCount: "Cantidad",
  rangeMin: "Mínimo",
  rangeMax: "Máximo",
  rangeCopied: (count) =>
    count === 1 ? "1 celda copiada" : `${integer.format(count)} celdas copiadas`,
  copyRange: "Copiar",
  rangeHint: "Arrastra o usa Mayús + flechas para seleccionar celdas; Ctrl + C las copia.",
  loadError: "No se pudieron cargar las filas.",
  retry: "Reintentar",
  loadingRows: "Cargando filas…",
  advancedFilter: "Filtro avanzado",
  addCondition: "Agregar condición",
  addGroup: "Agregar grupo",
  removeNode: "Quitar",
  matchAll: "Cumple todas (Y)",
  matchAny: "Cumple alguna (O)",
  filterAnd: "Y",
  filterOr: "O",
  filterColumn: "Columna",
  filterOperator: "Operador",
  filterValue: "Valor",
  filterValueTo: "Hasta",
  filterGroupLabel: "Grupo de condiciones",
  noConditions: "Sin condiciones. Agrega una para filtrar.",
  clearAdvancedFilter: "Limpiar filtro avanzado",
  operators: {
    contains: "contiene",
    notContains: "no contiene",
    equals: "es igual a",
    notEquals: "es distinto de",
    startsWith: "empieza con",
    endsWith: "termina con",
    gt: "es mayor que",
    gte: "es mayor o igual que",
    lt: "es menor que",
    lte: "es menor o igual que",
    between: "está entre",
    before: "es anterior a",
    after: "es posterior a",
    isEmpty: "está vacío",
    isNotEmpty: "no está vacío",
  },
  toolPanel: "Panel de columnas",
  panelColumns: "Columnas",
  panelRowGroups: "Agrupar filas",
  panelPivot: "Tabla dinámica",
  pivotMode: "Modo dinámico",
  pivotRows: "Filas",
  pivotColumn: "Columnas",
  pivotValue: "Valor",
  pivotAggregate: "Función",
  pivotIncomplete: "Elige al menos un campo de fila, la columna y el valor.",
  noneOption: "Ninguna",
  exportSelection: "Exportar selección",
  formulaBar: "Barra de fórmulas",
  formulaCell: "Celda",
  formulaEmpty: "Selecciona una celda",
  formulaError: "Error de fórmula",
  history: "Historial de cambios",
  undo: "Deshacer",
  redo: "Rehacer",
  addRow: "Agregar fila",
  removeRows: "Eliminar filas",
  undone: (count) => (count === 1 ? "1 cambio deshecho" : `${count} cambios deshechos`),
  redone: (count) => (count === 1 ? "1 cambio rehecho" : `${count} cambios rehechos`),
  pasted: (count) => (count === 1 ? "1 celda pegada" : `${count} celdas pegadas`),
  filled: (count) => (count === 1 ? "1 celda rellenada" : `${count} celdas rellenadas`),
};
