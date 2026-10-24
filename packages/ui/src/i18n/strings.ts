export interface UiStrings {
  retry: string;
  close: string;
  loading: string;
  optional: string;
  save: string;
  unsavedChanges: string;
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
  /** Default accessible name of an `Aside`. */
  aside: string;
  /** Back action of a single-pane `ListDetail`. */
  backToList: string;
  /** Screen-reader state of a `DueChip` past its date. */
  overdue: string;
  /** Screen-reader state of a `DueChip` due within its `soonDays`. */
  dueSoon: string;
  /** Screen-reader state of a completed `Stepper` step. */
  stepDone: string;
  /** Screen-reader state of a `Stepper` step that has an error. */
  stepError: string;
  /** Name of a row checkbox in a `Table`; `{row}` is replaced by the row's label. */
  selectRow: string;
  /** Name of the select-all checkbox of a `Table`. */
  selectAll: string;
  /** Name of the overflow menu trigger of a `TableActionsCell`. */
  rowActions: string;
  /** Default body of a `TableEmpty` row. */
  tableEmpty: string;
  /** Label of the `TableColumnsMenu` trigger and its group. */
  columns: string;
  /** Name of the `Pagination` landmark. */
  pagination: string;
  /** Label of the page size picker of a `Pagination`. */
  rowsPerPage: string;
  /** Range text of a `Pagination`; `{first}`, `{last}` and `{total}` are replaced. */
  pageRange: string;
  firstPage: string;
  previousPage: string;
  nextPage: string;
  lastPage: string;
  /** Range text of a `Pagination variant="pages"`; `{first}`, `{last}` and `{total}` are replaced. */
  showingRange: string;
  /** Range text of a `CursorPagination` (no known total); `{first}` and `{last}` are replaced. */
  showingRangeOpen: string;
  /** Visible label of the previous-page button of `Pagination variant="pages"` and `CursorPagination`. */
  previous: string;
  /** Name of a page number button; `{page}` is replaced. */
  pageNumber: string;
  /** Name of the search field of a `FilterBar`. */
  search: string;
  /** Label of the `FilterBar` button that opens every filter under a narrow container. */
  filters: string;
  /** Label of the `FilterBar` button that opens the extra filters. */
  moreFilters: string;
  /** Clears every active filter of a `FilterBar`. */
  clearAllFilters: string;
  /** Name of the remove button of an active filter chip; `{filter}` is replaced by its label. */
  removeFilter: string;
  /** Name of the list of active filter chips of a `FilterBar`. */
  activeFilters: string;
  /** Result count of a `FilterBar` for exactly one result. */
  resultOne: string;
  /** Result count of a `FilterBar`; `{count}` is replaced. */
  resultMany: string;
  /** Name of the `PasswordInput` toggle; its pressed state says whether the password is visible. */
  showPassword: string;
  /** Default title of a `LoginForm`. */
  signIn: string;
  /** Label of the portal picker of a `LoginForm`. */
  signInAs: string;
  /** Divider between the portal picker and the credential fields. */
  withYourAccount: string;
  /** Default label and placeholder of the `LoginForm` identifier field. */
  identifier: string;
  /** Default label and placeholder of the `LoginForm` password field. */
  password: string;
  /** Default `LoginForm` link to recover a password. */
  forgotPassword: string;
  /** Submit button label of a `LoginForm`. */
  signInAction: string;
  /** Inline error of a `LoginForm` submitted without an identifier. */
  enterIdentifier: string;
  /** Inline error of a `LoginForm` submitted without a password. */
  enterPassword: string;
  /** Label of the remember-me checkbox of `LoginForm.Options`. */
  rememberMe: string;
  /** Default help link of `LoginForm.Options`. */
  needHelp: string;
  /** Default label of `LoginForm.Providers`. */
  orLogInWith: string;
  /** Message shown by a `LoginForm` when sign-in fails and the app gives none. */
  signInFailed: string;
  /** Default headline of the `statement` look of `AuthIllustration`. */
  welcomeBack: string;
  /** Line the `statement` look of `AuthIllustration` shows once sign-in succeeds. */
  signedIn: string;
}

export type UiLocale = "en" | "es";

export const uiStrings = {
  en: {
    retry: "Retry",
    close: "Close",
    loading: "Loading",
    optional: "optional",
    save: "Save",
    unsavedChanges: "Unsaved changes",
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
    aside: "Related information",
    backToList: "Back to list",
    overdue: "Overdue",
    dueSoon: "Due soon",
    stepDone: "Completed",
    stepError: "Has an error",
    selectRow: "Select {row}",
    selectAll: "Select all rows",
    rowActions: "Row actions",
    tableEmpty: "No rows to show",
    columns: "Columns",
    pagination: "Pagination",
    rowsPerPage: "Rows per page",
    pageRange: "{first}–{last} of {total}",
    firstPage: "First page",
    previousPage: "Previous page",
    nextPage: "Next page",
    lastPage: "Last page",
    showingRange: "Showing {first}–{last} of {total}",
    showingRangeOpen: "Showing {first}–{last}",
    previous: "Previous",
    pageNumber: "Page {page}",
    search: "Search",
    filters: "Filters",
    moreFilters: "More filters",
    clearAllFilters: "Clear all filters",
    removeFilter: "Remove filter {filter}",
    activeFilters: "Active filters",
    resultOne: "1 result",
    resultMany: "{count} results",
    showPassword: "Show password",
    signIn: "Sign in",
    signInAs: "Sign in as",
    withYourAccount: "with your account",
    identifier: "Email or ID",
    password: "Password",
    forgotPassword: "Forgot your password?",
    signInAction: "Sign in",
    enterIdentifier: "Enter your email or ID.",
    enterPassword: "Enter your password.",
    rememberMe: "Remember me",
    needHelp: "Need help?",
    orLogInWith: "Or log in with",
    signInFailed: "We could not sign you in. Check your details and try again.",
    welcomeBack: "Good to see you again.",
    signedIn: "You're in.",
  },
  es: {
    retry: "Reintentar",
    close: "Cerrar",
    loading: "Cargando",
    optional: "opcional",
    save: "Guardar",
    unsavedChanges: "Cambios sin guardar",
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
    aside: "Información relacionada",
    backToList: "Volver a la lista",
    overdue: "Vencido",
    dueSoon: "Vence pronto",
    stepDone: "Completado",
    stepError: "Tiene un error",
    selectRow: "Seleccionar {row}",
    selectAll: "Seleccionar todas las filas",
    rowActions: "Acciones de la fila",
    tableEmpty: "No hay filas para mostrar",
    columns: "Columnas",
    pagination: "Paginación",
    rowsPerPage: "Filas por página",
    pageRange: "{first}–{last} de {total}",
    firstPage: "Primera página",
    previousPage: "Página anterior",
    nextPage: "Página siguiente",
    lastPage: "Última página",
    showingRange: "Mostrando {first}–{last} de {total}",
    showingRangeOpen: "Mostrando {first}–{last}",
    previous: "Anterior",
    pageNumber: "Página {page}",
    search: "Buscar",
    filters: "Filtros",
    moreFilters: "Más filtros",
    clearAllFilters: "Limpiar todos los filtros",
    removeFilter: "Quitar filtro {filter}",
    activeFilters: "Filtros activos",
    resultOne: "1 resultado",
    resultMany: "{count} resultados",
    showPassword: "Mostrar contraseña",
    signIn: "Inicia sesión",
    signInAs: "Ingresar como",
    withYourAccount: "con tu cuenta",
    identifier: "Correo o documento",
    password: "Contraseña",
    forgotPassword: "¿Olvidaste tu contraseña?",
    signInAction: "Ingresar",
    enterIdentifier: "Escribe tu correo o documento.",
    enterPassword: "Escribe tu contraseña.",
    rememberMe: "Recordarme",
    needHelp: "¿Necesitas ayuda?",
    orLogInWith: "O ingresa con",
    signInFailed: "No pudimos iniciar tu sesión. Revisa tus datos e inténtalo de nuevo.",
    welcomeBack: "Qué bueno verte otra vez.",
    signedIn: "Ya estás dentro.",
  },
} as const satisfies Record<UiLocale, UiStrings>;
