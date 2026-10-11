@file:OptIn(ExperimentalTestApi::class)

package com.jcsoftdev.ui.overlays

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotDisplayed
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.click
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTouchInput
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

class OverlaysUiTest {
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

    @Test
    fun sheetClosesOnBackAndScrim() =
        runComposeUiTest {
            val back = BackDispatcher()
            var open by mutableStateOf(true)
            setContent(screen(back) { Sheet(open, { open = false }, "Servicios", dismissLabel = "Close") { Text("Cuerpo") } })
            onNodeWithText("Cuerpo").assertIsDisplayed()
            onNodeWithText("Servicios").assert(
                SemanticsMatcher.keyIsDefined(SemanticsProperties.PaneTitle).not() or
                    SemanticsMatcher.keyIsDefined(SemanticsProperties.Text),
            )
            assertTrue(back.dispatch())
            waitForIdle()
            assertFalse(open)
            onNodeWithText("Cuerpo").assertDoesNotExist()
            open = true
            waitForIdle()
            onNodeWithText("Cuerpo").assertIsDisplayed()
            onNodeWithContentDescription("Close").performTouchInput { click(Offset(4f, 4f)) }
            waitForIdle()
            assertFalse(open)
            onNodeWithText("Cuerpo").assertDoesNotExist()
        }

    @Test
    fun nonDismissibleSheetIgnoresBackAndScrim() =
        runComposeUiTest {
            val back = BackDispatcher()
            var dismissed = 0
            setContent(screen(back) { Sheet(true, { dismissed++ }, "Obligatorio", dismissible = false) { Text("Cuerpo") } })
            back.dispatch()
            waitForIdle()
            assertEquals(0, dismissed)
            onNodeWithText("Cuerpo").assertIsDisplayed()
        }

    @Test
    fun sheetBodyScrollsAndFooterStaysReachable() =
        runComposeUiTest {
            var added = 0
            setContent(
                screen {
                    Sheet(
                        open = true,
                        onDismiss = {},
                        title = "Agregar",
                        footer = { Button("Guardar", { added++ }) },
                    ) {
                        Column { repeat(60) { Text("Fila $it") } }
                    }
                },
            )
            onNodeWithText("Fila 59").assertIsNotDisplayed()
            onNodeWithText("Guardar").assertIsDisplayed()
            onNodeWithText("Fila 59").performScrollTo().assertIsDisplayed()
            onNodeWithText("Guardar").assertIsDisplayed().performClick()
            assertEquals(1, added)
        }

    @Test
    fun dialogDismissRulesAreConfigurable() =
        runComposeUiTest {
            val back = BackDispatcher()
            var requests = 0
            var scrim by mutableStateOf(false)
            var backEnabled by mutableStateOf(false)
            setContent(
                screen(back) {
                    Dialog(
                        open = true,
                        onDismissRequest = { requests++ },
                        title = "Cancelar cita",
                        description = "Esta accion no se puede deshacer",
                        dismissOnScrim = scrim,
                        dismissOnBack = backEnabled,
                        dismissLabel = "Close",
                        actions = { Button("Confirmar", {}) },
                    ) {}
                },
            )
            onNodeWithText("Cancelar cita").assertIsDisplayed()
            onNodeWithText("Confirmar").assertIsDisplayed()
            onNodeWithText("Esta accion no se puede deshacer").assertIsDisplayed()
            back.dispatch()
            waitForIdle()
            assertEquals(0, requests)
            scrim = true
            backEnabled = true
            waitForIdle()
            back.dispatch()
            waitForIdle()
            assertEquals(1, requests)
            onNodeWithContentDescription("Close").performTouchInput { click(Offset(4f, 4f)) }
            waitForIdle()
            assertEquals(2, requests)
        }

    @Test
    fun toasterShowsTwoAndQueuesTheRest() =
        runComposeUiTest {
            val state = ToastHostState()
            setContent(screen { Toaster(state) })
            val first = state.toast("Uno")
            state.success("Dos")
            state.error("Tres")
            waitForIdle()
            onNodeWithText("Uno").assertIsDisplayed()
            onNodeWithText("Dos").assertIsDisplayed()
            onNodeWithText("Tres").assertDoesNotExist()
            state.dismiss(first)
            waitForIdle()
            onNodeWithText("Uno").assertDoesNotExist()
            onNodeWithText("Tres").assertIsDisplayed()
            assertEquals(2, state.toasts.size)
            state.dismiss()
            waitForIdle()
            assertTrue(state.toasts.isEmpty())
        }

    @Test
    fun toastActionRunsAndDismisses() =
        runComposeUiTest {
            val state = ToastHostState()
            var undone = 0
            setContent(screen { Toaster(state) })
            state.info("Cita cancelada", ToastAction("Deshacer") { undone++ })
            waitForIdle()
            onNodeWithText("Deshacer").performClick()
            waitForIdle()
            assertEquals(1, undone)
            onNodeWithText("Cita cancelada").assertDoesNotExist()
        }

    @Test
    fun toastsExpireAfterTheDuration() =
        runComposeUiTest {
            val state = ToastHostState()
            setContent(screen { Toaster(state) })
            state.toast("Guardado")
            waitForIdle()
            mainClock.advanceTimeBy(5_500)
            onNodeWithText("Guardado").assertExists()
            mainClock.advanceTimeBy(1_000)
            onNodeWithText("Guardado").assertDoesNotExist()
        }

    @Test
    fun menuEntriesReportRolesAndDismissAfterChoosing() =
        runComposeUiTest {
            var dismissed = 0
            var edited = 0
            var sort by mutableStateOf("name")
            var compact by mutableStateOf(false)
            setContent(
                screen {
                    Menu(expanded = true, onDismissRequest = { dismissed++ }) {
                        item("Editar", { edited++ })
                        separator()
                        radioItem("Por nombre", sort == "name", { sort = "name" })
                        radioItem("Por fecha", sort == "date", { sort = "date" })
                        checkboxItem("Compacto", compact, { compact = it })
                    }
                },
            )
            onNodeWithText("Por nombre").assertIsSelected()
            onNodeWithText("Por nombre").assert(SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.RadioButton))
            onNodeWithText("Compacto").assert(SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.Checkbox))
            onNodeWithText("Por fecha").performClick()
            assertEquals("date", sort)
            assertEquals(1, dismissed)
            onNodeWithText("Compacto").performClick()
            assertTrue(compact)
            onNodeWithText("Editar").performClick()
            assertEquals(1, edited)
            assertEquals(3, dismissed)
        }
}
