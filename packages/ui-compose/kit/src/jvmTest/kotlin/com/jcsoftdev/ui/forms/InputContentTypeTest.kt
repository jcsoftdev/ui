@file:OptIn(ExperimentalTestApi::class, ExperimentalComposeUiApi::class)

package com.jcsoftdev.ui.forms

import androidx.compose.runtime.Composable
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.autofill.ContentType
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.runComposeUiTest
import androidx.compose.ui.text.font.FontFamily
import com.jcsoftdev.ui.foundation.Motion
import com.jcsoftdev.ui.theme.UiTheme
import kotlin.test.Test

class InputContentTypeTest {
    private fun themed(content: @Composable () -> Unit): @Composable () -> Unit =
        { UiTheme(dark = false, fontFamily = FontFamily.Default, motion = Motion(0f)) { content() } }

    private fun hasContentType(expected: ContentType) = SemanticsMatcher.expectValue(SemanticsProperties.ContentType, expected)

    @Test
    fun inputMapsEveryContentType() {
        val expected =
            mapOf(
                InputContentType.Username to ContentType.Username,
                InputContentType.NewUsername to ContentType.NewUsername,
                InputContentType.Email to ContentType.EmailAddress,
                InputContentType.Phone to ContentType.PhoneNumber,
                InputContentType.Password to ContentType.Password,
                InputContentType.NewPassword to ContentType.NewPassword,
                InputContentType.OneTimeCode to ContentType.SmsOtpCode,
            )
        for ((kind, compose) in expected) {
            runComposeUiTest {
                setContent(themed { Input("", {}, contentType = kind, contentDescription = "f") })
                onNodeWithContentDescription("f").assert(hasContentType(compose))
            }
        }
    }

    @Test
    fun inputWithoutContentTypeStaysUnlabelled() =
        runComposeUiTest {
            setContent(themed { Input("", {}, contentDescription = "f") })
            onNodeWithContentDescription("f").assert(SemanticsMatcher.keyNotDefined(SemanticsProperties.ContentType))
        }

    @Test
    fun passwordInputDefaultsToPasswordAndAcceptsNewPassword() {
        runComposeUiTest {
            setContent(themed { PasswordInput("", {}, contentDescription = "pw") })
            onNodeWithContentDescription("pw").assert(hasContentType(ContentType.Password))
        }
        runComposeUiTest {
            setContent(themed { PasswordInput("", {}, contentDescription = "pw", contentType = InputContentType.NewPassword) })
            onNodeWithContentDescription("pw").assert(hasContentType(ContentType.NewPassword))
        }
    }
}
