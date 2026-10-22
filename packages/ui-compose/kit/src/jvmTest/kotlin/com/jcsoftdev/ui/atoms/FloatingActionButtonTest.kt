@file:OptIn(ExperimentalTestApi::class)

package com.jcsoftdev.ui.atoms

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertHeightIsEqualTo
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertWidthIsEqualTo
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.runComposeUiTest
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.foundation.Motion
import com.jcsoftdev.ui.theme.UiTheme
import kotlin.test.Test
import kotlin.test.assertEquals

class FloatingActionButtonTest {
    private fun themed(content: @androidx.compose.runtime.Composable () -> Unit): @androidx.compose.runtime.Composable () -> Unit =
        {
            UiTheme(dark = false, fontFamily = FontFamily.Default, motion = Motion(0f)) {
                Box(Modifier.wrapContentSize(Alignment.TopStart)) { content() }
            }
        }

    private val button = SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.Button)

    @Test
    fun iconOnlyIs56dpDescribedAndClickable() =
        runComposeUiTest {
            var clicks = 0
            setContent(themed { FloatingActionButton({ clicks++ }, "Nueva cita") { Box(Modifier.size(24.dp)) } })
            onNodeWithContentDescription("Nueva cita")
                .assert(button)
                .assertIsEnabled()
                .assertWidthIsEqualTo(56.dp)
                .assertHeightIsEqualTo(56.dp)
                .performClick()
            assertEquals(1, clicks)
        }

    @Test
    fun disabledFabIgnoresTaps() =
        runComposeUiTest {
            var clicks = 0
            setContent(themed { FloatingActionButton({ clicks++ }, "Nueva cita", enabled = false) { Box(Modifier.size(24.dp)) } })
            onNodeWithContentDescription("Nueva cita").assertIsNotEnabled().performClick()
            assertEquals(0, clicks)
        }

    @Test
    fun extendedShowsItsLabelAndCollapsesToADescribedIcon() =
        runComposeUiTest {
            var expanded by mutableStateOf(true)
            setContent(themed { ExtendedFloatingActionButton("Nueva cita", {}, expanded = expanded, icon = { Box(Modifier.size(24.dp)) }) })
            onNodeWithText("Nueva cita").assert(button).assertHeightIsEqualTo(56.dp)
            expanded = false
            waitForIdle()
            onNodeWithText("Nueva cita").assertDoesNotExist()
            onNodeWithContentDescription("Nueva cita").assert(button).assertWidthIsEqualTo(56.dp).assertHeightIsEqualTo(56.dp)
        }

    @Test
    fun extendedWithoutIconNeverCollapses() =
        runComposeUiTest {
            setContent(themed { ExtendedFloatingActionButton("Guardar", {}, expanded = false) })
            onNodeWithText("Guardar").assert(button)
        }
}
