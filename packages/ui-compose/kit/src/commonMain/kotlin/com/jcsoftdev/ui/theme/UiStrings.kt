package com.jcsoftdev.ui.theme

import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ProvidableCompositionLocal
import androidx.compose.runtime.staticCompositionLocalOf

/**
 * Every fallback label the kit shows or announces, the counterpart of the web `UiStringsProvider` strings. Components default
 * their label parameters to these, so a localized app provides one [UiStrings] to [UiTheme] instead of a label per call; an
 * explicit parameter always wins. [En] and [Es] ship with the kit, `copy` adapts either, and any other language builds its own.
 */
@Immutable
public class UiStrings(
    public val dismiss: String,
    public val back: String,
    public val retry: String,
    public val loading: String,
    public val close: String,
    public val optional: String,
    public val cancel: String,
    public val confirm: String,
    public val processing: String,
    public val correlationPrefix: String,
    public val actionFailed: String,
    public val somethingWrong: String,
    public val actions: String,
    public val notifications: String,
    public val showPassword: String,
    public val hidePassword: String,
    public val increase: String,
    public val decrease: String,
) {
    /** Copy with selected strings replaced. */
    public fun copy(
        dismiss: String = this.dismiss,
        back: String = this.back,
        retry: String = this.retry,
        loading: String = this.loading,
        close: String = this.close,
        optional: String = this.optional,
        cancel: String = this.cancel,
        confirm: String = this.confirm,
        processing: String = this.processing,
        correlationPrefix: String = this.correlationPrefix,
        actionFailed: String = this.actionFailed,
        somethingWrong: String = this.somethingWrong,
        actions: String = this.actions,
        notifications: String = this.notifications,
        showPassword: String = this.showPassword,
        hidePassword: String = this.hidePassword,
        increase: String = this.increase,
        decrease: String = this.decrease,
    ): UiStrings =
        UiStrings(
            dismiss,
            back,
            retry,
            loading,
            close,
            optional,
            cancel,
            confirm,
            processing,
            correlationPrefix,
            actionFailed,
            somethingWrong,
            actions,
            notifications,
            showPassword,
            hidePassword,
            increase,
            decrease,
        )

    public companion object {
        /** English, the default. */
        public val En: UiStrings =
            UiStrings(
                dismiss = "Dismiss",
                back = "Back",
                retry = "Retry",
                loading = "Loading",
                close = "Close",
                optional = "optional",
                cancel = "Cancel",
                confirm = "Confirm",
                processing = "Processing…",
                correlationPrefix = "ID:",
                actionFailed = "The action could not be completed. Try again.",
                somethingWrong = "Something went wrong. Try again.",
                actions = "Actions",
                notifications = "Notifications",
                showPassword = "Show password",
                hidePassword = "Hide password",
                increase = "Increase",
                decrease = "Decrease",
            )

        /** Spanish, same wording as the web kit's `es` strings. */
        public val Es: UiStrings =
            UiStrings(
                dismiss = "Descartar",
                back = "Atrás",
                retry = "Reintentar",
                loading = "Cargando",
                close = "Cerrar",
                optional = "opcional",
                cancel = "Cancelar",
                confirm = "Confirmar",
                processing = "Procesando…",
                correlationPrefix = "ID:",
                actionFailed = "No se pudo completar la acción. Inténtalo de nuevo.",
                somethingWrong = "Algo salió mal. Inténtalo de nuevo.",
                actions = "Acciones",
                notifications = "Notificaciones",
                showPassword = "Mostrar contraseña",
                hidePassword = "Ocultar contraseña",
                increase = "Aumentar",
                decrease = "Disminuir",
            )
    }
}

/** The [UiStrings] components read; [UiTheme] provides it from its `strings` parameter. */
public val LocalUiStrings: ProvidableCompositionLocal<UiStrings> = staticCompositionLocalOf { UiStrings.En }
