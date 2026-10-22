@file:OptIn(ExperimentalTestApi::class)

package com.jcsoftdev.ui.auth

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertHeightIsAtLeast
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.runComposeUiTest
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.foundation.Motion
import com.jcsoftdev.ui.theme.UiTheme
import kotlin.test.Test
import kotlin.test.assertEquals
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

    @Test
    fun scaffoldAcceptsEveryStateWithoutAnimation() =
        runComposeUiTest {
            var state by mutableStateOf(AuthState.Idle)
            setContent(screen { AuthScaffold("Title", "Tag", state = state, progress = 0.5f) { Box(Modifier.size(10.dp)) } })
            for (s in AuthState.entries) {
                state = s
                waitForIdle()
                onNodeWithText("Title").assertExists()
            }
        }
}
