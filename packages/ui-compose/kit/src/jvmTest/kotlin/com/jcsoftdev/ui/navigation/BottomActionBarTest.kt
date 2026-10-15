@file:OptIn(ExperimentalTestApi::class)

package com.jcsoftdev.ui.navigation

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertHeightIsAtLeast
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.runComposeUiTest
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.atoms.Button
import com.jcsoftdev.ui.atoms.ButtonVariant
import com.jcsoftdev.ui.foundation.Motion
import com.jcsoftdev.ui.theme.UiTheme
import kotlin.test.Test
import kotlin.test.assertEquals

class BottomActionBarTest {
    private fun screen(content: @Composable () -> Unit): @Composable () -> Unit =
        {
            Box(Modifier.size(320.dp, 480.dp)) {
                UiTheme(dark = false, fontFamily = FontFamily.Default, motion = Motion(0f)) { content() }
            }
        }

    @Test
    fun barSitsAtTheBottomAndItsActionsWork() =
        runComposeUiTest {
            var confirmed = 0
            setContent(
                screen {
                    Column(Modifier.fillMaxSize()) {
                        Box(Modifier.weight(1f))
                        BottomActionBar(Modifier.testTag("bar")) { Button("Confirmar", { confirmed++ }, variant = ButtonVariant.Primary) }
                    }
                },
            )
            val bar = onNodeWithTag("bar")
            bar.assert(SemanticsMatcher.expectValue(SemanticsProperties.IsTraversalGroup, true))
            bar.assertHeightIsAtLeast(48.dp)
            assertEquals(480.dp, bar.getUnclippedBoundsInRoot().bottom)
            onNodeWithText("Confirmar").performClick()
            assertEquals(1, confirmed)
        }

    @Test
    fun barLiftsAboveADockDrawnOverTheSameArea() =
        runComposeUiTest {
            setContent(
                screen {
                    Box(Modifier.fillMaxSize()) {
                        BottomActionBar(Modifier.testTag("bar").align(Alignment.BottomCenter), dockHeight = 64.dp) {
                            Button("Guardar", {})
                        }
                        Box(Modifier.testTag("dock").align(Alignment.BottomCenter).size(320.dp, 64.dp))
                    }
                },
            )
            val dock = onNodeWithTag("dock").getUnclippedBoundsInRoot()
            val bar = onNodeWithTag("bar").getUnclippedBoundsInRoot()
            assertEquals(416.dp, dock.top)
            assertEquals(dock.top, bar.bottom)
        }
}
