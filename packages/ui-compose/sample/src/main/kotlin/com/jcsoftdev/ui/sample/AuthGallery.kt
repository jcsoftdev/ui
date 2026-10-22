package com.jcsoftdev.ui.sample

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.atoms.Button
import com.jcsoftdev.ui.auth.AuthHeaderShape
import com.jcsoftdev.ui.auth.LoginScreen
import com.jcsoftdev.ui.theme.UiStrings
import com.jcsoftdev.ui.theme.UiTheme

@Composable
fun AuthGallery(
    dark: Boolean = false,
    shape: AuthHeaderShape = AuthHeaderShape.Overlap,
) {
    UiTheme(dark = dark, accent = "#77D3AD", strings = UiStrings.Es) {
        var id by remember { mutableStateOf("") }
        var password by remember { mutableStateOf("") }
        var error by remember { mutableStateOf<String?>(null) }
        var success by remember { mutableStateOf(false) }
        var headerShape by remember { mutableStateOf(shape) }
        Box(Modifier.fillMaxSize()) {
            LoginScreen(
                title = "Bienvenido",
                tagline = "Ingresa con tu cuenta del colegio",
                id = id,
                onIdChange = {
                    id = it
                    error = null
                },
                idLabel = "Correo o código",
                password = password,
                onPasswordChange = {
                    password = it
                    error = null
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
            )
            Row(Modifier.align(Alignment.TopEnd).padding(top = 8.dp, end = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(if (headerShape == AuthHeaderShape.Overlap) "Arc" else "Overlap", {
                    headerShape = if (headerShape == AuthHeaderShape.Overlap) AuthHeaderShape.Arc else AuthHeaderShape.Overlap
                })
            }
        }
    }
}
