@file:OptIn(ExperimentalTestApi::class)

package com.jcsoftdev.ui.forms

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertIsNotSelected
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.runComposeUiTest
import androidx.compose.ui.text.font.FontFamily
import com.jcsoftdev.ui.atoms.ButtonDefaults
import com.jcsoftdev.ui.atoms.ButtonSize
import com.jcsoftdev.ui.foundation.Motion
import com.jcsoftdev.ui.navigation.TabItem
import com.jcsoftdev.ui.navigation.Tabs
import com.jcsoftdev.ui.theme.UiTheme
import kotlin.test.Test
import kotlin.test.assertEquals

class FormsUiTest {
    private fun themed(content: @androidx.compose.runtime.Composable () -> Unit): @androidx.compose.runtime.Composable () -> Unit =
        { UiTheme(dark = false, fontFamily = FontFamily.Default, motion = Motion(0f)) { content() } }

    @Test
    fun passwordToggleRevealsAndHides() =
        runComposeUiTest {
            setContent(
                themed {
                    var value by mutableStateOf("secreto")
                    PasswordInput(value, { value = it }, showLabel = "Show", hideLabel = "Hide", contentDescription = "pw")
                },
            )
            onNodeWithContentDescription("pw").assert(SemanticsMatcher.keyIsDefined(SemanticsProperties.EditableText))
            onNodeWithContentDescription("pw").assertTextEquals("•".repeat(7), includeEditableText = true)
            onNodeWithContentDescription("Show").performClick()
            onNodeWithContentDescription("Hide").assertExists()
            onNodeWithContentDescription("pw").assertTextEquals("secreto", includeEditableText = true)
            onNodeWithContentDescription("Hide").performClick()
            onNodeWithContentDescription("Show").assertExists()
        }

    @Test
    fun pinInputAcceptsPastedCodeAndCompletesOnce() =
        runComposeUiTest {
            var code by mutableStateOf("")
            val completed = mutableListOf<String>()
            setContent(themed { PinInput(code, { code = it }, length = 6, contentDescription = "otp", onComplete = { completed += it }) })
            onNodeWithContentDescription("otp").performTextInput("12a34-5678")
            assertEquals("123456", code)
            assertEquals(listOf("123456"), completed)
        }

    @Test
    fun timeInputTypesDigitsAndMasks() =
        runComposeUiTest {
            var time by mutableStateOf("")
            setContent(themed { TimeInput(time, { time = it }, contentDescription = "hora") })
            onNodeWithContentDescription("hora").performTextInput("0930")
            assertEquals("09:30", time)
            onNodeWithContentDescription("hora").assertTextEquals("09:30", includeEditableText = true)
        }

    @Test
    fun tabsExposeTabRoleAndSelection() =
        runComposeUiTest {
            var selected by mutableStateOf("a")
            setContent(themed { Tabs(listOf(TabItem("a", "Citas", 3), TabItem("b", "Clientes")), selected, { selected = it }) })
            val isTab = SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.Tab)
            onNodeWithText("Citas", useUnmergedTree = false).assertExists()
            onNode(isTab and SemanticsMatcher.expectValue(SemanticsProperties.Selected, true)).assertExists()
            onNodeWithText("Clientes").performClick()
            assertEquals("b", selected)
            onNodeWithText("Clientes").assertIsSelected()
            onNodeWithText("Citas").assertIsNotSelected()
        }

    @Test
    fun largeInputIsAsTallAsTheLargeButton() =
        runComposeUiTest {
            var md = 0
            var lg = 0
            var expected = 0
            setContent(
                themed {
                    expected = with(LocalDensity.current) { ButtonDefaults.height(ButtonSize.Lg).roundToPx() }
                    Column {
                        Box(Modifier.onSizeChanged { md = it.height }) { Input("", {}) }
                        Box(Modifier.onSizeChanged { lg = it.height }) { Input("", {}, size = InputSize.Lg) }
                    }
                },
            )
            waitForIdle()
            assert(lg >= expected && lg > md) { "lg=$lg md=$md expected=$expected" }
        }
}
