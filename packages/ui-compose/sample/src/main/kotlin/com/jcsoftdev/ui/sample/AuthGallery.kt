package com.jcsoftdev.ui.sample

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.atoms.Button
import com.jcsoftdev.ui.atoms.ButtonSize
import com.jcsoftdev.ui.auth.AuthFloatingArt
import com.jcsoftdev.ui.auth.AuthHeaderShape
import com.jcsoftdev.ui.auth.AuthPrimaryButton
import com.jcsoftdev.ui.auth.AuthScaffoldDefaults
import com.jcsoftdev.ui.auth.AuthState
import com.jcsoftdev.ui.auth.LoginScreen
import com.jcsoftdev.ui.theme.UiStrings
import com.jcsoftdev.ui.theme.UiTheme

/**
 * The sign-in family on a phone: welcome or form, overlapping or arc-cut sheet, arcs or floating art, a forced header state
 * (Auto follows the form) and dark mode, all from the small "Ajustes" panel at the top end.
 */
@Composable
fun AuthGallery(
    dark: Boolean = false,
    shape: AuthHeaderShape = AuthHeaderShape.Overlap,
) {
    var isDark by remember { mutableStateOf(dark) }
    UiTheme(dark = isDark, accent = "#77D3AD", strings = UiStrings.Es) {
        var id by remember { mutableStateOf("") }
        var password by remember { mutableStateOf("") }
        var error by remember { mutableStateOf<String?>(null) }
        var success by remember { mutableStateOf(false) }
        var headerShape by remember { mutableStateOf(shape) }
        var welcome by remember { mutableStateOf(true) }
        var floating by remember { mutableStateOf(false) }
        var forced by remember { mutableStateOf<AuthState?>(null) }
        var panel by remember { mutableStateOf(false) }
        Box(Modifier.fillMaxSize()) {
            LoginScreen(
                title = "Bienvenido",
                tagline = "Ingresa con tu cuenta del colegio",
                id = id,
                onIdChange = {
                    id = it
                    error = null
                    success = false
                },
                idLabel = "Correo o código",
                password = password,
                onPasswordChange = {
                    password = it
                    error = null
                    success = false
                },
                passwordLabel = "Contraseña",
                submitText = "Ingresar",
                onSubmit = {
                    if (password.length < 6) error = "Contraseña incorrecta" else success = true
                },
                error = error,
                success = success,
                forgotText = "¿Olvidaste tu contraseña?",
                secondaryText = "¿Eres nuevo? Regístrate",
                headerShape = headerShape,
                art = { state, progress ->
                    val shown = forced ?: state
                    if (floating) {
                        AuthFloatingArt(shown, progress, Modifier.fillMaxSize())
                    } else {
                        AuthScaffoldDefaults.Art(shown, progress)
                    }
                },
                expanded = welcome,
                welcomeTitle = "Aprende sin límites",
                welcomeTagline = "Clases, notas y mensajes de tu colegio en un solo lugar",
                welcomeAction = { AuthPrimaryButton("Empezar", { welcome = false }, Modifier.fillMaxWidth()) },
                onBackToWelcome = { welcome = true },
            )
            Column(
                Modifier.align(Alignment.TopEnd).windowInsetsPadding(WindowInsets.safeDrawing).padding(top = 8.dp, end = 8.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
                horizontalAlignment = Alignment.End,
            ) {
                Button(if (panel) "Cerrar" else "Ajustes", { panel = !panel }, size = ButtonSize.Sm)
                if (panel) {
                    Button(if (welcome) "Ver formulario" else "Ver bienvenida", { welcome = !welcome }, size = ButtonSize.Sm)
                    Button(if (headerShape == AuthHeaderShape.Overlap) "Forma: superpuesta" else "Forma: arco", {
                        headerShape = if (headerShape == AuthHeaderShape.Overlap) AuthHeaderShape.Arc else AuthHeaderShape.Overlap
                    }, size = ButtonSize.Sm)
                    Button(if (floating) "Arte: piezas" else "Arte: arcos", { floating = !floating }, size = ButtonSize.Sm)
                    Button("Estado: ${forced?.name ?: "Auto"}", { forced = nextForced(forced) }, size = ButtonSize.Sm)
                    Button(if (isDark) "Tema: oscuro" else "Tema: claro", { isDark = !isDark }, size = ButtonSize.Sm)
                }
            }
        }
    }
}

private fun nextForced(current: AuthState?): AuthState? {
    val order = listOf<AuthState?>(null) + AuthState.entries
    return order[(order.indexOf(current) + 1) % order.size]
}
