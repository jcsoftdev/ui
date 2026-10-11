@file:OptIn(ExperimentalTestApi::class)

package com.jcsoftdev.ui.atoms

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.state.ToggleableState
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertIsNotSelected
import androidx.compose.ui.test.assertIsOff
import androidx.compose.ui.test.assertIsOn
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.runComposeUiTest
import androidx.compose.ui.text.font.FontFamily
import com.jcsoftdev.ui.foundation.Motion
import com.jcsoftdev.ui.theme.UiTheme
import kotlin.test.Test
import kotlin.test.assertEquals

class AtomsUiTest {
    @Test
    fun switchToggles() =
        runComposeUiTest {
            var checked by mutableStateOf(false)
            setContent {
                UiTheme(dark = false, fontFamily = FontFamily.Default, motion = Motion(0f)) {
                    Switch(checked, { checked = it }, contentDescription = "notify")
                }
            }
            onNodeWithContentDescription("notify").assertIsOff().performClick().assertIsOn()
            assertEquals(true, checked)
        }

    @Test
    fun checkboxCyclesAndReportsIndeterminate() =
        runComposeUiTest {
            var state by mutableStateOf(ToggleableState.Indeterminate)
            setContent {
                UiTheme(dark = false, fontFamily = FontFamily.Default, motion = Motion(0f)) {
                    Checkbox(state, {
                        state =
                            if (state ==
                                ToggleableState.On
                            ) {
                                ToggleableState.Off
                            } else {
                                ToggleableState.On
                            }
                    }, contentDescription = "all")
                }
            }
            onNodeWithContentDescription(
                "all",
            ).assert(
                SemanticsMatcher.expectValue(
                    androidx.compose.ui.semantics.SemanticsProperties.ToggleableState,
                    ToggleableState.Indeterminate,
                ),
            )
            onNodeWithContentDescription("all").performClick()
            assertEquals(ToggleableState.On, state)
        }

    @Test
    fun radioGroupSelectsOne() =
        runComposeUiTest {
            var value by mutableStateOf<String?>("a")
            val options = listOf(RadioOption("a", "Alpha"), RadioOption("b", "Beta", "second"))
            setContent {
                UiTheme(dark = false, fontFamily = FontFamily.Default, motion = Motion(0f)) {
                    RadioGroup(options, value, { value = it })
                }
            }
            onNodeWithText("Alpha").assertIsSelected()
            onNodeWithText("Beta").assertIsNotSelected().performClick().assertIsSelected()
            assertEquals("b", value)
        }

    @Test
    fun disabledButtonIgnoresClicks() =
        runComposeUiTest {
            var clicks = 0
            setContent {
                UiTheme(dark = false, fontFamily = FontFamily.Default, motion = Motion(0f)) {
                    Button("Save", { clicks++ }, loading = true)
                    Button("Off", { clicks++ }, enabled = false)
                    Button("Go", { clicks++ })
                }
            }
            onNodeWithText("Off").assertIsNotEnabled()
            onNodeWithText("Go").performClick()
            assertEquals(1, clicks)
        }
}
