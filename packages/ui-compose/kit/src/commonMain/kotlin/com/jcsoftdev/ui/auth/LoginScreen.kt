package com.jcsoftdev.ui.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.vector.ImageVector
import com.jcsoftdev.ui.forms.InputContentType
import com.jcsoftdev.ui.icons.Icons
import com.jcsoftdev.ui.icons.User

/**
 * The common sign-in screen: [AuthScaffold] with an identifier field, a password field, an optional "forgot" link, a pinned
 * primary action and an optional secondary link. It drives the header art itself: [AuthState] and the 0..1 progress come from
 * the field lengths, the password focus, [error] and [success] (see [AuthProgress]). All text comes from the caller.
 *
 * [error] non-null marks both fields invalid and shows the message under the password. [loading] makes the action ignore taps.
 * Pressing the keyboard's done key on the password calls [onSubmit]. [expanded], [welcomeTitle], [welcomeTagline],
 * [welcomeAction] and [onBackToWelcome] open the welcome mode of [AuthScaffold] in front of the form. This is a convenience over the parts
 * ([AuthScaffold], [AuthTextField], [AuthPasswordField], [AuthPrimaryButton], [AuthLink]); use them directly for another layout.
 */
@Composable
public fun LoginScreen(
    title: String,
    tagline: String,
    id: String,
    onIdChange: (String) -> Unit,
    idLabel: String,
    password: String,
    onPasswordChange: (String) -> Unit,
    passwordLabel: String,
    submitText: String,
    onSubmit: () -> Unit,
    modifier: Modifier = Modifier,
    error: String? = null,
    success: Boolean = false,
    loading: Boolean = false,
    loadingDescription: String? = null,
    forgotText: String? = null,
    onForgot: () -> Unit = {},
    secondaryText: String? = null,
    onSecondary: () -> Unit = {},
    idLeadingIcon: ImageVector? = Icons.User,
    idContentType: InputContentType = InputContentType.Username,
    idKeyboardOptions: KeyboardOptions = AuthFieldDefaults.IdKeyboard,
    headerShape: AuthHeaderShape = AuthHeaderShape.Overlap,
    colors: AuthScaffoldColors = AuthScaffoldDefaults.colors(),
    art: @Composable (state: AuthState, progress: Float) -> Unit = AuthScaffoldDefaults.Art,
    expanded: Boolean = false,
    welcomeTitle: String = title,
    welcomeTagline: String = tagline,
    welcomeAction: (@Composable ColumnScope.() -> Unit)? = null,
    onBackToWelcome: (() -> Unit)? = null,
) {
    var passwordFocused by remember { mutableStateOf(false) }
    val state = AuthProgress.stateOf(id.length, password.length, passwordFocused, error != null, success)
    AuthScaffold(
        title,
        tagline,
        modifier,
        state = state,
        progress = AuthProgress.of(id.length, password.length),
        colors = colors,
        headerShape = headerShape,
        art = art,
        expanded = expanded,
        welcomeTitle = welcomeTitle,
        welcomeTagline = welcomeTagline,
        welcomeAction = welcomeAction,
        onBackToWelcome = onBackToWelcome,
        bottom = { LoginActions(submitText, onSubmit, loading, loadingDescription, secondaryText, onSecondary) },
    ) {
        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(AuthFieldDefaults.rhythm)) {
            AuthTextField(
                id,
                onIdChange,
                idLabel,
                Modifier.fillMaxWidth(),
                error = error?.let { "" },
                leadingIcon = idLeadingIcon,
                contentType = idContentType,
                keyboardOptions = idKeyboardOptions,
            )
            AuthPasswordField(
                password,
                onPasswordChange,
                passwordLabel,
                Modifier.fillMaxWidth().onFocusChanged { passwordFocused = it.hasFocus },
                error = error,
                keyboardActions = KeyboardActions(onDone = { onSubmit() }),
            )
            if (forgotText != null) AuthLink(forgotText, onForgot, Modifier.align(Alignment.End))
        }
    }
}

@Composable
private fun ColumnScope.LoginActions(
    submitText: String,
    onSubmit: () -> Unit,
    loading: Boolean,
    loadingDescription: String?,
    secondaryText: String?,
    onSecondary: () -> Unit,
) {
    AuthPrimaryButton(submitText, onSubmit, Modifier.fillMaxWidth(), loading = loading, loadingDescription = loadingDescription)
    if (secondaryText != null) AuthLink(secondaryText, onSecondary, Modifier.align(Alignment.CenterHorizontally))
}
