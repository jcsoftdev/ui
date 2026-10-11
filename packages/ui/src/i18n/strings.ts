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
  },
} as const satisfies Record<UiLocale, UiStrings>;
