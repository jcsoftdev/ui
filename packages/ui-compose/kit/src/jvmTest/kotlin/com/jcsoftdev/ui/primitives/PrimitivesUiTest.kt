@file:OptIn(ExperimentalTestApi::class)

package com.jcsoftdev.ui.primitives

import androidx.compose.animation.core.snap
import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsFocused
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.click
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performKeyInput
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.pressKey
import androidx.compose.ui.test.requestFocus
import androidx.compose.ui.test.runComposeUiTest
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.foundation.BackDispatcher
import com.jcsoftdev.ui.foundation.BackPriority
import com.jcsoftdev.ui.foundation.LocalBackDispatcher
import com.jcsoftdev.ui.foundation.Motion
import com.jcsoftdev.ui.navigation.Segmented
import com.jcsoftdev.ui.navigation.SegmentedOption
import com.jcsoftdev.ui.theme.UiTheme
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class PrimitivesUiTest {
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
    fun modalLayerHidesTheBackgroundAndGivesFocusBack() =
        runComposeUiTest {
            var open by mutableStateOf(false)
            val field = FocusRequester()
            val hidden = SemanticsMatcher.keyIsDefined(SemanticsProperties.HideFromAccessibility)
            setContent(
                screen {
                    Box(
                        Modifier
                            .size(40.dp)
                            .testTag("field")
                            .focusRequester(field)
                            .focusable(),
                    )
                    OverlayLayer(visible = open, onDismissRequest = { open = false }) {
                        Box(Modifier.testTag("layer").size(20.dp).focusable())
                    }
                },
            )
            runOnIdle { field.requestFocus() }
            onNodeWithTag("field").assertIsFocused()
            open = true
            waitForIdle()
            onNode(hidden).assertExists()
            onNodeWithTag("layer").assertExists()
            open = false
            waitForIdle()
            onNode(hidden).assertDoesNotExist()
            onNodeWithTag("field").assertIsFocused()
        }

    @Test
    fun nonModalLayerKeepsTheBackgroundVisibleAndIgnoresBack() =
        runComposeUiTest {
            val back = BackDispatcher()
            val hidden = SemanticsMatcher.keyIsDefined(SemanticsProperties.HideFromAccessibility)
            setContent(screen(back) { OverlayLayer(visible = true, modal = false) { Text("Toast-like") } })
            onNodeWithText("Toast-like").assertIsDisplayed()
            onNode(hidden).assertDoesNotExist()
            assertFalse(back.dispatch())
        }

    @Test
    fun backGoesToTheHighestPriorityLayer() =
        runComposeUiTest {
            val back = BackDispatcher()
            var low = 0
            var high = 0
            setContent(
                screen(back) {
                    OverlayLayer(visible = true, onDismissRequest = { low++ }, backPriority = BackPriority.OVERLAY) {}
                    OverlayLayer(visible = true, onDismissRequest = { high++ }, backPriority = BackPriority.SHEET) {}
                },
            )
            assertTrue(back.dispatch())
            assertEquals(0, low)
            assertEquals(1, high)
        }

    @Test
    fun dismissOnBackOffConsumesBackWithoutDismissing() =
        runComposeUiTest {
            val back = BackDispatcher()
            var dismissed = 0
            setContent(screen(back) { OverlayLayer(visible = true, onDismissRequest = { dismissed++ }, dismissOnBack = false) {} })
            assertTrue(back.dispatch())
            assertEquals(0, dismissed)
        }

    @Test
    fun modalLayerTapOnTheScrimDismissesWhenAllowed() =
        runComposeUiTest {
            var dismissed = 0
            var allow by mutableStateOf(false)
            setContent(
                screen {
                    ModalLayer(
                        open = true,
                        onDismissRequest = { dismissed++ },
                        dismissOnScrimTap = allow,
                        scrim = { tap -> Box(tap.fillMaxSize().background(Color.Black).testTag("scrim")) },
                    ) {}
                },
            )
            onNodeWithTag("scrim").performClickAt()
            assertEquals(0, dismissed)
            allow = true
            waitForIdle()
            onNodeWithTag("scrim").performClickAt()
            assertEquals(1, dismissed)
        }

    @Test
    fun sheetStateSettlesBackToRest() =
        runComposeUiTest {
            lateinit var state: SheetState
            var settled by mutableStateOf(false)
            setContent(
                screen {
                    state = rememberSheetState(settleSpec = snap())
                    LaunchedEffect(Unit) {
                        state.dragBy(120f)
                        state.settle()
                        settled = true
                    }
                },
            )
            waitForIdle()
            assertTrue(settled)
            assertEquals(0f, state.offset)
        }

    @Test
    fun headlessToastHostDrawsCallerUiAndExpires() =
        runComposeUiTest {
            val state = ToastHostState(maxVisible = 1)
            setContent(screen { ToastHost(state) { toast -> Text("custom ${toast.message}", Modifier.testTag("t${toast.id}")) } })
            val first = state.toast("one", durationMillis = 1_000)
            state.success("two", durationMillis = 1_000)
            waitForIdle()
            onNodeWithText("custom one").assertIsDisplayed()
            onNodeWithText("custom two").assertDoesNotExist()
            mainClock.advanceTimeBy(1_300)
            onNodeWithText("custom one").assertDoesNotExist()
            onNodeWithText("custom two").assertIsDisplayed()
            assertEquals(first + 1, state.toasts.single().id)
            mainClock.advanceTimeBy(1_300)
            assertTrue(state.toasts.isEmpty())
        }

    @Test
    fun segmentedFollowsArrowKeysAndWraps() =
        runComposeUiTest {
            var value by mutableStateOf<String?>("a")
            setContent(
                screen {
                    Segmented(
                        listOf(SegmentedOption("a", "Day"), SegmentedOption("b", "Week"), SegmentedOption("c", "Month")),
                        value,
                        { value = it },
                    )
                },
            )
            onNodeWithText("Day").requestFocusAndPress(Key.DirectionRight)
            waitForIdle()
            assertEquals("b", value)
            onNodeWithText("Week").assertIsSelected()
            onNodeWithText("Week").requestFocusAndPress(Key.MoveEnd)
            waitForIdle()
            assertEquals("c", value)
            onNodeWithText("Month").requestFocusAndPress(Key.DirectionRight)
            waitForIdle()
            assertEquals("a", value)
        }
}

private fun SemanticsNodeInteraction.performClickAt() {
    performTouchInput { click(Offset(4f, 4f)) }
}

private fun SemanticsNodeInteraction.requestFocusAndPress(key: Key) {
    requestFocus()
    performKeyInput { pressKey(key) }
}
