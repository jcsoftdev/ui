@file:OptIn(ExperimentalTestApi::class)

package com.jcsoftdev.ui.theme

import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.runComposeUiTest
import androidx.compose.ui.text.font.FontFamily
import com.jcsoftdev.ui.containers.Banner
import com.jcsoftdev.ui.forms.NumberStepper
import com.jcsoftdev.ui.forms.PasswordInput
import com.jcsoftdev.ui.foundation.Motion
import kotlin.test.Test

class UiStringsTest {
    @Test
    fun spanishStringsReachBannerAndPasswordToggle() =
        runComposeUiTest {
            setContent {
                UiTheme(dark = false, fontFamily = FontFamily.Default, motion = Motion(0f), strings = UiStrings.Es) {
                    Banner("Aviso", onDismiss = {})
                    PasswordInput("x", {})
                    NumberStepper(1, {})
                }
            }
            onNodeWithContentDescription("Descartar").assertExists()
            onNodeWithContentDescription("Aumentar").assertExists()
            onNodeWithContentDescription("Mostrar contraseña").performClick()
            onNodeWithContentDescription("Ocultar contraseña").assertExists()
        }

    @Test
    fun englishIsTheDefault() =
        runComposeUiTest {
            setContent { UiTheme(dark = false, fontFamily = FontFamily.Default, motion = Motion(0f)) { Banner("Notice", onDismiss = {}) } }
            onNodeWithContentDescription("Dismiss").assertExists()
        }

    @Test
    fun explicitParametersWin() =
        runComposeUiTest {
            setContent {
                UiTheme(dark = false, fontFamily = FontFamily.Default, motion = Motion(0f), strings = UiStrings.Es) {
                    Banner("Aviso", onDismiss = {}, dismissLabel = "Cerrar aviso")
                    PasswordInput("x", {}, showLabel = "Ver")
                }
            }
            onNodeWithContentDescription("Cerrar aviso").assertExists()
            onNodeWithContentDescription("Descartar").assertDoesNotExist()
            onNodeWithContentDescription("Ver").assertExists()
        }
}
