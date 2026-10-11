@file:OptIn(ExperimentalTestApi::class)

package com.jcsoftdev.ui.primitives

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.tween
import androidx.compose.foundation.MutatePriority
import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.LocalSaveableStateRegistry
import androidx.compose.runtime.saveable.SaveableStateRegistry
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.ComposeUiTest
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsFocused
import androidx.compose.ui.test.assertIsNotFocused
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.click
import androidx.compose.ui.test.down
import androidx.compose.ui.test.isFocused
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performKeyInput
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.pressKey
import androidx.compose.ui.test.requestFocus
import androidx.compose.ui.test.runComposeUiTest
import androidx.compose.ui.test.up
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.foundation.BackDispatcher
import com.jcsoftdev.ui.foundation.BackPriority
import com.jcsoftdev.ui.foundation.LocalBackDispatcher
import com.jcsoftdev.ui.foundation.Motion
import com.jcsoftdev.ui.navigation.Segmented
import com.jcsoftdev.ui.navigation.SegmentedOption
import com.jcsoftdev.ui.overlays.OverlayHost
import com.jcsoftdev.ui.overlays.Sheet
import com.jcsoftdev.ui.theme.UiTheme
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
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
            onNodeWithTag("field").assertIsNotFocused()
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
    fun segmentedFocusFollowsTheSelectionIncludingWrapAndEnds() =
        runComposeUiTest {
            var value by mutableStateOf<String?>("a")
            setContent(
                screen {
                    Column {
                        Segmented(
                            listOf(SegmentedOption("a", "Day"), SegmentedOption("b", "Week"), SegmentedOption("c", "Month")),
                            value,
                            { value = it },
                        )
                        Box(Modifier.size(20.dp).testTag("after").focusable())
                    }
                },
            )
            onNodeWithText("Day").requestFocus()
            onNodeWithText("Day").assertIsFocused()
            pressOnRoot(Key.DirectionRight)
            assertEquals("b", value)
            onNodeWithText("Week").assertIsSelected()
            onNodeWithText("Week").assertIsFocused()
            pressOnRoot(Key.MoveEnd)
            assertEquals("c", value)
            onNodeWithText("Month").assertIsFocused()
            pressOnRoot(Key.DirectionRight)
            assertEquals("a", value)
            onNodeWithText("Day").assertIsFocused()
            onNodeWithTag("after").assertIsNotFocused()
            pressOnRoot(Key.DirectionLeft)
            assertEquals("c", value)
            onNodeWithText("Month").assertIsFocused()
            pressOnRoot(Key.MoveHome)
            assertEquals("a", value)
            onNodeWithText("Day").assertIsFocused()
        }

    private fun ComposeUiTest.pressOnRoot(key: Key) {
        onRoot().performKeyInput { pressKey(key) }
        waitForIdle()
    }

    @Test
    fun customLayerOverAKitSheetAnswersBackFirstAndTheReverse() =
        runComposeUiTest {
            val back = BackDispatcher()
            var sheetOpen by mutableStateOf(true)
            var layerOpen by mutableStateOf(false)
            var sheetClosed = 0
            var layerClosed = 0
            setContent(
                screen(back) {
                    Sheet(sheetOpen, { sheetClosed++ }, "Sheet") { Box(Modifier.size(20.dp)) }
                    OverlayLayer(visible = layerOpen, onDismissRequest = { layerClosed++ }) { Box(Modifier.size(20.dp)) }
                },
            )
            layerOpen = true
            waitForIdle()
            assertTrue(back.dispatch())
            assertEquals(1, layerClosed)
            assertEquals(0, sheetClosed)
            layerOpen = false
            sheetOpen = false
            waitForIdle()
            layerOpen = true
            waitForIdle()
            sheetOpen = true
            waitForIdle()
            assertTrue(back.dispatch())
            assertEquals(1, sheetClosed)
            assertEquals(1, layerClosed)
        }

    @Test
    fun nestedModalsHideEveryLayerBelowAndFocusReturnsToTheLayerBelow() =
        runComposeUiTest {
            var top by mutableStateOf(false)
            val inBottom = FocusRequester()
            setContent(
                screen {
                    Box(Modifier.size(10.dp).testTag("app").focusable())
                    OverlayLayer(visible = true) {
                        Box(
                            Modifier
                                .size(20.dp)
                                .testTag("bottom")
                                .focusRequester(inBottom)
                                .focusable(),
                        )
                    }
                    OverlayLayer(visible = top, z = 5) { Box(Modifier.size(20.dp).testTag("top").focusable()) }
                },
            )
            runOnIdle { inBottom.requestFocus() }
            onNodeWithTag("bottom").assertIsFocused()
            assertFalse(onNodeWithTag("bottom", useUnmergedTree = true).hiddenFromAccessibility())
            assertTrue(onNodeWithTag("app", useUnmergedTree = true).hiddenFromAccessibility())
            top = true
            waitForIdle()
            assertTrue(onNodeWithTag("bottom", useUnmergedTree = true).hiddenFromAccessibility())
            assertFalse(onNodeWithTag("top", useUnmergedTree = true).hiddenFromAccessibility())
            top = false
            waitForIdle()
            assertFalse(onNodeWithTag("bottom", useUnmergedTree = true).hiddenFromAccessibility())
            val focused = onAllNodes(isFocused(), useUnmergedTree = true).fetchSemanticsNodes()
            assertEquals(1, focused.size)
            val ancestors = generateSequence(onNodeWithTag("bottom", useUnmergedTree = true).fetchSemanticsNode()) { it.parent }
            assertTrue(ancestors.any { it.id == focused.single().id }, "focus must be inside the layer below")
        }

    @Test
    fun changingModalOrZOnAVisibleLayerUpdatesTheHost() =
        runComposeUiTest {
            var modal by mutableStateOf(true)
            var zA by mutableStateOf(0)
            setContent(
                screen {
                    Box(Modifier.size(10.dp).testTag("app"))
                    OverlayLayer(visible = true, modal = modal, z = zA) { Box(Modifier.size(20.dp).testTag("a")) }
                    OverlayLayer(visible = true, z = 1) { Box(Modifier.size(20.dp).testTag("b")) }
                },
            )
            assertTrue(onNodeWithTag("a", useUnmergedTree = true).hiddenFromAccessibility())
            assertFalse(onNodeWithTag("b", useUnmergedTree = true).hiddenFromAccessibility())
            zA = 2
            waitForIdle()
            assertFalse(onNodeWithTag("a", useUnmergedTree = true).hiddenFromAccessibility())
            assertTrue(onNodeWithTag("b", useUnmergedTree = true).hiddenFromAccessibility())
            modal = false
            waitForIdle()
            onNodeWithTag("a").assertExists()
            assertFalse(onNodeWithTag("b", useUnmergedTree = true).hiddenFromAccessibility())
            assertTrue(onNodeWithTag("app", useUnmergedTree = true).hiddenFromAccessibility())
        }

    @Test
    fun overlayHostWorksWithoutAUiTheme() =
        runComposeUiTest {
            var open by mutableStateOf(false)
            setContent {
                OverlayHost {
                    Box(Modifier.size(10.dp).testTag("app"))
                    OverlayLayer(visible = open) { Box(Modifier.size(20.dp).testTag("layer")) }
                }
            }
            onNodeWithTag("layer").assertDoesNotExist()
            open = true
            waitForIdle()
            onNodeWithTag("layer").assertExists()
            assertTrue(onNodeWithTag("app", useUnmergedTree = true).hiddenFromAccessibility())
        }

    @Test
    fun sheetStateSettlesWithTheThemeMotionAfterADragStop() =
        runComposeUiTest {
            lateinit var state: SheetState
            lateinit var scope: kotlinx.coroutines.CoroutineScope
            var dismissed = 0
            setContent(
                screen {
                    state = rememberSheetState()
                    scope = rememberCoroutineScope()
                },
            )
            runOnIdle {
                state.updateHeight(1000f)
                state.dragBy(100f)
                scope.launch { state.onDragStopped(0f, { dismissed++ }, { true }) }
            }
            waitForIdle()
            assertEquals(0, dismissed)
            assertEquals(0f, state.offset)
            runOnIdle {
                state.dragBy(600f)
                scope.launch { state.onDragStopped(0f, { dismissed++ }, { false }) }
            }
            waitForIdle()
            assertEquals(1, dismissed)
            assertEquals(600f, state.offset)
        }

    @Test
    fun aNewDragCancelsTheSettleAnimation() =
        runComposeUiTest {
            lateinit var state: SheetState
            lateinit var scope: kotlinx.coroutines.CoroutineScope
            var cancelled = false
            var finished = false
            setContent(
                screen {
                    state = rememberSheetState(settleSpec = tween(1_000, easing = LinearEasing))
                    scope = rememberCoroutineScope()
                },
            )
            runOnIdle { state.dragBy(500f) }
            mainClock.autoAdvance = false
            runOnIdle {
                scope.launch {
                    try {
                        state.settle()
                        finished = true
                    } catch (e: CancellationException) {
                        cancelled = true
                        throw e
                    }
                }
            }
            mainClock.advanceTimeBy(300)
            val mid = state.offset
            assertTrue(mid in 1f..499f, "settling, was $mid")
            runOnIdle { scope.launch { state.draggable.drag(MutatePriority.UserInput) { dragBy(7f) } } }
            mainClock.advanceTimeBy(2_000)
            assertTrue(cancelled)
            assertFalse(finished)
            assertTrue(state.offset > 0f)
        }

    @Test
    fun aSheetDismissedByDragOpensAtRestAgain() =
        runComposeUiTest {
            var open by mutableStateOf(true)
            lateinit var state: SheetState
            setContent(
                screen {
                    state = rememberSheetState()
                    Sheet(open, { open = false }, "S", state = state) { Box(Modifier.size(20.dp).testTag("body")) }
                },
            )
            runOnIdle { state.dragBy(300f) }
            assertTrue(state.offset > 0f)
            open = false
            waitForIdle()
            onNodeWithTag("body").assertDoesNotExist()
            assertEquals(0f, state.offset)
            open = true
            waitForIdle()
            assertEquals(0f, state.offset)
            onNodeWithTag("body").assertExists()
        }

    @Test
    fun maskedInputCanBeClearedFromOutsideAndFollowsTheParent() =
        runComposeUiTest {
            var value by mutableStateOf("")
            lateinit var input: MaskedInputState
            val mask = DigitMask(4, ':', listOf(2))
            setContent(
                screen {
                    input = rememberMaskedInputState(value, { value = it }, mask)
                    BasicTextField(
                        input.digits,
                        input::onInput,
                        Modifier.testTag("field"),
                        visualTransformation = input.visualTransformation,
                    )
                },
            )
            onNodeWithTag("field").performTextInput("093")
            waitForIdle()
            assertEquals("093", input.digits)
            onNodeWithText("09:3").assertExists()
            runOnIdle { input.reset() }
            waitForIdle()
            assertEquals("", input.digits)
            onNodeWithText("09:3").assertDoesNotExist()
            onNodeWithTag("field").performTextInput("0930")
            waitForIdle()
            assertEquals("0930", value)
            value = ""
            waitForIdle()
            assertEquals("", input.digits)
            value = "12:45"
            waitForIdle()
            assertEquals("1245", input.digits)
            onNodeWithText("12:45").assertExists()
        }

    @Test
    fun aToastPausesWhileTouchedOrFocusedAndIndefiniteOnesNeverExpire() =
        runComposeUiTest {
            val state = ToastHostState(maxVisible = 3)
            setContent(
                screen {
                    ToastHost(state) { toast -> Box(Modifier.size(40.dp).testTag("t${toast.id}").focusable()) }
                },
            )
            val touched = state.toast("touch", durationMillis = 1_000)
            waitForIdle()
            onNodeWithTag("t$touched").performTouchInput { down(center) }
            mainClock.advanceTimeBy(3_000)
            onNodeWithTag("t$touched").assertExists()
            onNodeWithTag("t$touched").performTouchInput { up() }
            mainClock.advanceTimeBy(1_500)
            onNodeWithTag("t$touched").assertDoesNotExist()

            val focused = state.toast("focus", durationMillis = 1_000)
            waitForIdle()
            onNodeWithTag("t$focused").requestFocus()
            mainClock.advanceTimeBy(3_000)
            onNodeWithTag("t$focused").assertExists()
            runOnIdle { state.dismiss(focused) }
            waitForIdle()
            onNodeWithTag("t$focused").assertDoesNotExist()

            val forever = state.toast("forever", durationMillis = ToastHostState.INDEFINITE)
            mainClock.advanceTimeBy(600_000)
            onNodeWithTag("t$forever").assertExists()
            val instant = state.toast("zero", durationMillis = 0)
            waitForIdle()
            mainClock.advanceTimeBy(300)
            onNodeWithTag("t$instant").assertDoesNotExist()
        }

    @Test
    fun singleSelectionSurvivesRestoration() =
        runComposeUiTest {
            var registry by mutableStateOf(SaveableStateRegistry(null) { true })
            var shown by mutableStateOf(true)
            lateinit var selection: SingleSelectionState<String>
            setContent {
                CompositionLocalProvider(LocalSaveableStateRegistry provides registry) {
                    if (shown) selection = rememberSingleSelectionState("a")
                }
            }
            val restore = {
                val saved = registry.performSave()
                runOnIdle { shown = false }
                waitForIdle()
                registry = SaveableStateRegistry(saved) { true }
                runOnIdle { shown = true }
                waitForIdle()
            }
            runOnIdle { selection.select("b") }
            restore()
            assertEquals("b", selection.selected)
            runOnIdle { selection.clear() }
            restore()
            assertNull(selection.selected)
        }
}

private fun SemanticsNodeInteraction.hiddenFromAccessibility(): Boolean =
    generateSequence(fetchSemanticsNode()) { it.parent }.any { SemanticsProperties.HideFromAccessibility in it.config }

private fun SemanticsNodeInteraction.performClickAt() {
    performTouchInput { click(Offset(4f, 4f)) }
}
