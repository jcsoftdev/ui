@file:OptIn(ExperimentalTestApi::class)

package com.jcsoftdev.ui.overlays

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsFocused
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.runComposeUiTest
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.atoms.Button
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.foundation.BackDispatcher
import com.jcsoftdev.ui.foundation.LocalBackDispatcher
import com.jcsoftdev.ui.foundation.Motion
import com.jcsoftdev.ui.theme.UiTheme
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class FullScreenModalTest {
    private fun screen(
        back: BackDispatcher = BackDispatcher(),
        content: @Composable () -> Unit,
    ): @Composable () -> Unit =
        {
            CompositionLocalProvider(LocalBackDispatcher provides back) {
                Box(Modifier.size(320.dp, 480.dp)) {
                    UiTheme(dark = false, fontFamily = FontFamily.Default, motion = Motion(0f)) { content() }
                }
            }
        }

    private fun SemanticsNodeInteraction.hiddenFromAccessibility(): Boolean =
        generateSequence(fetchSemanticsNode()) { it.parent }.any { SemanticsProperties.HideFromAccessibility in it.config }

    @Test
    fun hidesTheAppFromAccessibilityWhileOpenAndRestoresItAfter() =
        runComposeUiTest {
            var open by mutableStateOf(true)
            setContent(
                screen {
                    Box(Modifier.testTag("app")) { Text("Inicio") }
                    FullScreenModal(open, { open = false }, "Editar cita") { Text("Formulario") }
                },
            )
            assertTrue(onNodeWithTag("app", useUnmergedTree = true).hiddenFromAccessibility())
            assertFalse(onNodeWithText("Formulario", useUnmergedTree = true).hiddenFromAccessibility())
            open = false
            waitForIdle()
            onNodeWithText("Formulario").assertDoesNotExist()
            assertFalse(onNodeWithTag("app", useUnmergedTree = true).hiddenFromAccessibility())
        }

    @Test
    fun movesFocusToTheHeaderAndAnnouncesTheScreen() =
        runComposeUiTest {
            setContent(screen { FullScreenModal(true, {}, "Editar cita") { Text("Formulario") } })
            waitForIdle()
            onNodeWithText("Editar cita").assertIsFocused().assert(SemanticsMatcher.keyIsDefined(SemanticsProperties.Heading))
            onNode(SemanticsMatcher.expectValue(SemanticsProperties.PaneTitle, "Editar cita")).assertExists()
        }

    @Test
    fun backAndTheHeaderButtonDismiss() =
        runComposeUiTest {
            val back = BackDispatcher()
            var open by mutableStateOf(true)
            setContent(screen(back) { FullScreenModal(open, { open = false }, "Editar cita", backLabel = "Volver") { Text("Formulario") } })
            assertTrue(back.dispatch())
            waitForIdle()
            assertFalse(open)
            open = true
            waitForIdle()
            onNodeWithContentDescription("Volver").performClick()
            waitForIdle()
            assertFalse(open)
        }

    @Test
    fun nonDismissibleIgnoresBackAndShowsNoBackButton() =
        runComposeUiTest {
            val back = BackDispatcher()
            var dismissed = 0
            setContent(
                screen(back) {
                    FullScreenModal(true, { dismissed++ }, "Obligatorio", dismissible = false, backLabel = "Volver") { Text("Cuerpo") }
                },
            )
            back.dispatch()
            waitForIdle()
            assertEquals(0, dismissed)
            onNodeWithContentDescription("Volver").assertDoesNotExist()
            onNodeWithText("Cuerpo").assertIsDisplayed()
        }

    @Test
    fun footerStaysPinnedAndReachable() =
        runComposeUiTest {
            var saved = 0
            setContent(
                screen {
                    FullScreenModal(true, {}, "Editar", footer = { Button("Guardar", { saved++ }) }) {
                        repeat(60) { Text("Fila $it") }
                    }
                },
            )
            onNodeWithText("Guardar").assertIsDisplayed().performClick()
            assertEquals(1, saved)
        }
}
