package com.jcsoftdev.ui.screenshots

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.auth.AuthFloatingArt
import com.jcsoftdev.ui.auth.AuthHeaderShape
import com.jcsoftdev.ui.auth.AuthScaffoldDefaults
import com.jcsoftdev.ui.auth.AuthState
import com.jcsoftdev.ui.auth.LoginScreen
import kotlin.test.Test

private val FloatingArt: @Composable (AuthState, Float) -> Unit = { state, progress ->
    AuthFloatingArt(state, progress, Modifier.fillMaxSize())
}

class AuthShots {
    @Composable
    private fun login(
        id: String = "",
        password: String = "",
        error: String? = null,
        success: Boolean = false,
        shape: AuthHeaderShape = AuthHeaderShape.Overlap,
        floating: Boolean = false,
    ) = LoginScreen(
        title = "Welcome back",
        tagline = "Sign in with your school account",
        id = id,
        onIdChange = {},
        idLabel = "Email or student id",
        password = password,
        onPasswordChange = {},
        passwordLabel = "Password",
        submitText = "Sign in",
        onSubmit = {},
        modifier = Modifier,
        error = error,
        success = success,
        forgotText = "Forgot password?",
        secondaryText = "New here? Create an account",
        headerShape = shape,
        art = if (floating) FloatingArt else AuthScaffoldDefaults.Art,
    )

    @Test fun loginIdle() = shoot("auth", "login-idle", height = 640.dp) { login() }

    @Test fun loginFilled() = shoot("auth", "login-filled", height = 640.dp) { login(id = "ana@school.edu", password = "secret12") }

    @Test fun loginError() =
        shoot("auth", "login-error", height = 640.dp) { login(id = "ana@school.edu", password = "wrong", error = "Wrong password") }

    @Test fun loginSuccess() =
        shoot("auth", "login-success", height = 640.dp) {
            login(id = "ana@school.edu", password = "secret12", success = true)
        }

    @Test fun floatingIdle() = shoot("auth", "floating-idle", height = 640.dp) { login(floating = true) }

    @Test fun floatingArc() =
        shoot("auth", "floating-arc", height = 640.dp) { login(id = "ana@school.edu", shape = AuthHeaderShape.Arc, floating = true) }

    @Test fun loginArc() = shoot("auth", "login-arc", height = 640.dp) { login(id = "ana@school.edu", shape = AuthHeaderShape.Arc) }
}
