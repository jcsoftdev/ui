export interface UiStrings {
  retry: string;
  close: string;
  loading: string;
  optional: string;
  cancel: string;
  confirm: string;
  processing: string;
  correlationPrefix: string;
  actionFailed: string;
  somethingWrong: string;
  actions: string;
  notifications: string;
  breadcrumbs: string;
  live: string;
  reconnecting: string;
  offline: string;
  copy: string;
  copied: string;
  more: string;
  remove: string;
  noResults: string;
  clear: string;
  selectPlaceholder: string;
  openCalendar: string;
  calendar: string;
  previousMonth: string;
  nextMonth: string;
  time: string;
  /** BCP 47 locale used for date labels and the typed date format. */
  locale: string;
  dayPlaceholder: string;
  monthPlaceholder: string;
  yearPlaceholder: string;
  back: string;
  next: string;
  finish: string;
  /** Step announcement; `{current}`, `{total}` and `{label}` are replaced. */
  stepOf: string;
  steps: string;
}

export type UiLocale = "en" | "es";

export const uiStrings = {
  en: {
    retry: "Retry",
    close: "Close",
    loading: "Loading",
    optional: "optional",
    cancel: "Cancel",
    confirm: "Confirm",
    processing: "Processing…",
    correlationPrefix: "ID:",
    actionFailed: "The action could not be completed. Try again.",
    somethingWrong: "Something went wrong. Try again.",
    actions: "Actions",
    notifications: "Notifications",
    breadcrumbs: "Breadcrumbs",
    live: "Live",
    reconnecting: "Reconnecting…",
    offline: "Offline",
    copy: "Copy",
    copied: "Copied",
    more: "More",
    remove: "Remove",
    noResults: "No results",
    clear: "Clear",
    selectPlaceholder: "Select…",
    openCalendar: "Open calendar",
    calendar: "Calendar",
    previousMonth: "Previous month",
    nextMonth: "Next month",
    time: "Time",
    locale: "en-US",
    dayPlaceholder: "dd",
    monthPlaceholder: "mm",
    yearPlaceholder: "yyyy",
    back: "Back",
    next: "Next",
    finish: "Finish",
    stepOf: "Step {current} of {total}: {label}",
    steps: "Steps",
  },
  es: {
    retry: "Reintentar",
    close: "Cerrar",
    loading: "Cargando",
    optional: "opcional",
    cancel: "Cancelar",
    confirm: "Confirmar",
    processing: "Procesando…",
    correlationPrefix: "ID:",
    actionFailed: "No se pudo completar la acción. Inténtalo de nuevo.",
    somethingWrong: "Algo salió mal. Inténtalo de nuevo.",
    actions: "Acciones",
    notifications: "Notificaciones",
    breadcrumbs: "Ruta de navegación",
    live: "En vivo",
    reconnecting: "Reconectando…",
    offline: "Sin conexión",
    copy: "Copiar",
    copied: "Copiado",
    more: "Más",
    remove: "Quitar",
    noResults: "Sin resultados",
    clear: "Limpiar",
    selectPlaceholder: "Seleccionar…",
    openCalendar: "Abrir calendario",
    calendar: "Calendario",
    previousMonth: "Mes anterior",
    nextMonth: "Mes siguiente",
    time: "Hora",
    locale: "es-PE",
    dayPlaceholder: "dd",
    monthPlaceholder: "mm",
    yearPlaceholder: "aaaa",
    back: "Atrás",
    next: "Siguiente",
    finish: "Finalizar",
    stepOf: "Paso {current} de {total}: {label}",
    steps: "Pasos",
  },
} as const satisfies Record<UiLocale, UiStrings>;
