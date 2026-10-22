package com.jcsoftdev.ui.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
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
 * Pressing the keyboard's done key on the password calls [onSubmit] unless [loading]; both fields are disabled while [loading].
 * [errorKey] is an extra counter that replays the header's error reaction and the error announcement when it changes; the screen
 * also replays them by itself whenever a request ends in [error] or the error text changes. [expanded], [welcomeTitle], [welcomeTagline],
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
    errorKey: Int = 0,
) {
    var passwordFocused by remember { mutableStateOf(false) }
    val attempts = rememberFailedAttempts(error, loading)
    val replay = errorKey + attempts
    val submit = { if (!loading) onSubmit() }
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
        errorKey = replay,
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
                enabled = !loading,
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
                enabled = !loading,
                error = error,
                errorKey = replay,
                keyboardActions = KeyboardActions(onDone = { submit() }),
            )
            if (forgotText != null) AuthLink(forgotText, onForgot, Modifier.align(Alignment.End))
        }
    }
}

/**
 * Counts the sign-in attempts that ended in an error: a request that finishes (`loading` goes back to false) with an error, or an
 * error that changes its text. A caller that keeps the same error across a retry therefore still replays the header's reaction.
 */
internal class FailedAttempts(
    initialError: String?,
    initialLoading: Boolean,
) {
    var count: Int = 0
        private set
    private var wasLoading = initialLoading
    private var lastError = initialError

    /** Feeds the current screen state; returns the attempts counted so far. */
    fun observe(
        error: String?,
        loading: Boolean,
    ): Int {
        if (error != null && !loading && (wasLoading || error != lastError)) count++
        wasLoading = loading
        lastError = error
        return count
    }
}

@Composable
private fun rememberFailedAttempts(
    error: String?,
    loading: Boolean,
): Int {
    val counter = remember { FailedAttempts(error, loading) }
    var attempts by remember { mutableIntStateOf(0) }
    LaunchedEffect(error, loading) { attempts = counter.observe(error, loading) }
    return attempts
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
