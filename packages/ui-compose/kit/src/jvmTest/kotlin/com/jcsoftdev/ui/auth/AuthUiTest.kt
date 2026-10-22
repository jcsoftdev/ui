@file:OptIn(ExperimentalTestApi::class)

package com.jcsoftdev.ui.auth

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertHeightIsAtLeast
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performImeAction
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.runComposeUiTest
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.foundation.BackDispatcher
import com.jcsoftdev.ui.foundation.LocalBackDispatcher
import com.jcsoftdev.ui.foundation.Motion
import com.jcsoftdev.ui.theme.UiTheme
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class AuthUiTest {
    private fun screen(content: @Composable () -> Unit): @Composable () -> Unit =
        {
            Box(Modifier.size(360.dp, 700.dp)) {
                UiTheme(dark = false, fontFamily = FontFamily.Default, motion = Motion(0f)) { content() }
            }
        }

    @Composable
    private fun login(
        error: String? = null,
        loading: Boolean = false,
        onSubmit: () -> Unit = {},
    ) {
        var id by remember { mutableStateOf("") }
        var password by remember { mutableStateOf("") }
        LoginScreen(
            "Welcome",
            "Sign in",
            id,
            { id = it },
            "Email",
            password,
            { password = it },
            "Password",
            "Go",
            onSubmit,
            error = error,
            loading = loading,
            forgotText = "Forgot?",
            secondaryText = "Sign up",
        )
    }

    @Test
    fun fieldsAreWiredAndTitleAndLinksShow() =
        runComposeUiTest {
            setContent(screen { login() })
            onNodeWithText("Welcome").assertExists()
            onNodeWithText("Forgot?").assertExists()
            onNodeWithText("Sign up").assertExists()
            onNodeWithContentDescription("Email").performTextInput("ana")
            onNodeWithContentDescription("Email").assertTextEquals("ana", includeEditableText = true)
        }

    @Test
    fun passwordRevealTogglesMasking() =
        runComposeUiTest {
            setContent(screen { login() })
            onNodeWithContentDescription("Password").performTextInput("secret")
            onNodeWithContentDescription("Password").assertTextEquals("•".repeat(6), includeEditableText = true)
            onNodeWithContentDescription("Show password").performClick()
            onNodeWithContentDescription("Password").assertTextEquals("secret", includeEditableText = true)
            onNodeWithContentDescription("Hide password").assertExists()
        }

    @Test
    fun errorSetsSemanticsAndShowsMessage() =
        runComposeUiTest {
            setContent(screen { login(error = "Wrong password") })
            onNodeWithText("Wrong password").assertExists()
            onNodeWithContentDescription("Password").assert(SemanticsMatcher.keyIsDefined(SemanticsProperties.Error))
            onNodeWithContentDescription("Email").assert(SemanticsMatcher.keyIsDefined(SemanticsProperties.Error))
        }

    @Test
    fun noErrorMeansNoErrorSemantics() =
        runComposeUiTest {
            setContent(screen { login() })
            onNodeWithContentDescription("Password").assert(SemanticsMatcher.keyNotDefined(SemanticsProperties.Error))
        }

    @Test
    fun primaryButtonSubmitsUnlessLoading() =
        runComposeUiTest {
            var submitted = 0
            var loading by mutableStateOf(false)
            setContent(screen { login(loading = loading, onSubmit = { submitted++ }) })
            onNodeWithText("Go").performClick()
            assertEquals(1, submitted)
        }

    @Test
    fun loadingButtonIgnoresTaps() =
        runComposeUiTest {
            var submitted = 0
            setContent(screen { login(loading = true, onSubmit = { submitted++ }) })
            onNodeWithText("Go").performClick()
            assertEquals(0, submitted)
        }

    @Test
    fun linksHaveAtLeast48dpTarget() =
        runComposeUiTest {
            setContent(screen { login() })
            onNodeWithText("Forgot?").assertHeightIsAtLeast(48.dp)
            onNodeWithText("Sign up").assertHeightIsAtLeast(48.dp)
        }

    @Test
    fun sheetOverlapsTheHeaderBand() =
        runComposeUiTest {
            setContent(
                screen {
                    AuthScaffold("Title", "Tag") {
                        androidx.compose.foundation.layout
                            .Box(Modifier.size(10.dp))
                    }
                },
            )
            val title = onNodeWithText("Title").getUnclippedBoundsInRoot()
            val tag = onNodeWithText("Tag").getUnclippedBoundsInRoot()
            assertTrue(tag.bottom > title.bottom)
        }

    @Composable
    private fun welcomeScaffold(
        expanded: Boolean,
        onStart: () -> Unit = {},
        onBack: (() -> Unit)? = null,
    ) = AuthScaffold(
        "Title",
        "Tag",
        expanded = expanded,
        welcomeTitle = "Hello",
        welcomeTagline = "Big tagline",
        welcomeAction = { AuthPrimaryButton("Start", onStart) },
        onBackToWelcome = onBack,
    ) { Text("Form") }

    @Test
    fun expandedShowsOnlyTheWelcomeAndCallsTheAction() =
        runComposeUiTest {
            var started = 0
            setContent(screen { welcomeScaffold(expanded = true, onStart = { started++ }) })
            onNodeWithText("Hello").assertExists()
            onNodeWithText("Big tagline").assertExists()
            onNodeWithText("Form").assertDoesNotExist()
            onNodeWithText("Title").assertDoesNotExist()
            onNodeWithText("Start").performClick()
            assertEquals(1, started)
        }

    @Test
    fun collapsingHidesTheWelcomeAndShowsTheForm() =
        runComposeUiTest {
            var expanded by mutableStateOf(true)
            setContent(screen { welcomeScaffold(expanded = expanded, onStart = { expanded = false }) })
            onNodeWithText("Start").performClick()
            waitForIdle()
            onNodeWithText("Hello").assertDoesNotExist()
            onNodeWithText("Start").assertDoesNotExist()
            onNodeWithText("Form").assertExists()
            onNodeWithText("Title").assertExists()
        }

    @Test
    fun systemBackReturnsToTheWelcomeOnlyFromTheForm() =
        runComposeUiTest {
            val back = BackDispatcher()
            var expanded by mutableStateOf(false)
            var calls = 0
            setContent {
                CompositionLocalProvider(LocalBackDispatcher provides back) {
                    screen {
                        welcomeScaffold(expanded = expanded, onBack = {
                            calls++
                            expanded = true
                        })
                    }()
                }
            }
            assertTrue(back.dispatch())
            waitForIdle()
            assertEquals(1, calls)
            onNodeWithText("Hello").assertExists()
            assertFalse(back.dispatch(), "nothing to answer while the welcome shows: the host's own back goes on")
        }

    @Test
    fun theWelcomeTransitionSlidesTheSheetUpOverTime() =
        runComposeUiTest {
            mainClock.autoAdvance = false
            var expanded by mutableStateOf(true)
            setContent {
                Box(Modifier.size(360.dp, 700.dp)) {
                    UiTheme(dark = false, fontFamily = FontFamily.Default, motion = Motion(1f)) { welcomeScaffold(expanded) }
                }
            }
            mainClock.advanceTimeByFrame()
            expanded = false
            mainClock.advanceTimeBy(160)
            val early = onNodeWithText("Form").getUnclippedBoundsInRoot().top
            mainClock.advanceTimeBy(160)
            val later = onNodeWithText("Form").getUnclippedBoundsInRoot().top
            mainClock.advanceTimeBy(1500)
            val settled = onNodeWithText("Form").getUnclippedBoundsInRoot().top
            mainClock.advanceTimeBy(500)
            assertTrue(later < early, "the sheet rises while the transition runs")
            assertTrue(settled < later)
            assertEquals(settled, onNodeWithText("Form").getUnclippedBoundsInRoot().top, "and then rests")
        }

    @Test
    fun doneOnThePasswordSubmitsOnce() =
        runComposeUiTest {
            var submitted = 0
            setContent(screen { login(onSubmit = { submitted++ }) })
            onNodeWithContentDescription("Password").performImeAction()
            assertEquals(1, submitted)
        }

    @Test
    fun loadingDisablesTheFieldsSoDoneCannotSubmitAgain() =
        runComposeUiTest {
            var submitted = 0
            var loading by mutableStateOf(false)
            setContent(screen { login(loading = loading, onSubmit = { submitted++ }) })
            onNodeWithText("Go").performClick()
            loading = true
            waitForIdle()
            onNodeWithContentDescription("Email").assertIsNotEnabled()
            onNodeWithContentDescription("Password").assertIsNotEnabled()
            assertFailsWith<AssertionError> { onNodeWithContentDescription("Password").performImeAction() }
            onNodeWithText("Go").performClick()
            assertEquals(1, submitted, "only the first tap went through")
            loading = false
            waitForIdle()
            onNodeWithContentDescription("Password").assertIsEnabled()
        }

    private fun fontScaled(
        scale: Float,
        height: Dp,
        content: @Composable () -> Unit,
    ): @Composable () -> Unit =
        {
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, scale)) {
                Box(Modifier.size(360.dp, height)) {
                    UiTheme(dark = false, fontFamily = FontFamily.Default, motion = Motion(0f)) { content() }
                }
            }
        }

    private fun SemanticsNodeInteraction.isScrollable(): Boolean = runCatching { performScrollTo() }.isSuccess

    private fun assertReachableAtFontScale(height: Dp) =
        runComposeUiTest {
            setContent(fontScaled(2f, height) { login(error = "Wrong password") })
            for (field in listOf("Email", "Password")) {
                onNodeWithContentDescription(field).performScrollTo().assertIsDisplayed()
            }
            onNodeWithText("Forgot?").performScrollTo().assertIsDisplayed()
            onNodeWithText("Wrong password").performScrollTo().assertIsDisplayed()
            // the action is pinned when there is room and scrolls with the content when there is not
            onNodeWithText("Go").let { if (it.isScrollable()) it.performScrollTo() else it }.assertIsDisplayed()
            val band = onNodeWithText("Sign in").getUnclippedBoundsInRoot().bottom
            assertTrue(band <= height * 0.4f, "the header text stays within 40% of the screen, was $band of $height")
        }

    @Test
    fun atTwiceTheFontScaleEverythingIsReachableOn640dp() = assertReachableAtFontScale(640.dp)

    @Test
    fun atTwiceTheFontScaleEverythingIsReachableOn800dp() = assertReachableAtFontScale(800.dp)

    @Test
    fun atTwiceTheFontScaleEverythingIsReachableWhereTheKeyboardLeavesLittleRoom() = assertReachableAtFontScale(360.dp)

    @Test
    fun atNormalFontScaleTheActionStaysPinnedToTheFootEvenOnAShortScreen() =
        runComposeUiTest {
            setContent(fontScaled(1f, 380.dp) { login() })
            val button = onNodeWithText("Go").getUnclippedBoundsInRoot()
            assertTrue(button.bottom > 380.dp * 0.6f, "the action sits near the foot, it does not scroll away with the content")
        }

    @Test
    fun theSlotThatMovesIntoTheContentKeepsTheFieldState() =
        runComposeUiTest {
            var height by mutableStateOf(800.dp)
            setContent {
                val density = LocalDensity.current
                CompositionLocalProvider(LocalDensity provides Density(density.density, 2f)) {
                    Box(Modifier.size(360.dp, height)) {
                        UiTheme(dark = false, fontFamily = FontFamily.Default, motion = Motion(0f)) { login() }
                    }
                }
            }
            onNodeWithContentDescription("Password").performTextInput("secret")
            onNodeWithContentDescription("Show password").performClick()
            height = 400.dp
            waitForIdle()
            onNodeWithContentDescription("Password").assertTextEquals("secret", includeEditableText = true)
            onNodeWithContentDescription("Hide password").assertExists()
        }
}
