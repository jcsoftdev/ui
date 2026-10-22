package com.jcsoftdev.ui.auth

import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.Dp
import com.jcsoftdev.ui.atoms.Button
import com.jcsoftdev.ui.atoms.ButtonColors
import com.jcsoftdev.ui.atoms.ButtonDefaults
import com.jcsoftdev.ui.atoms.ButtonVariant
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.atoms.pressableTarget
import com.jcsoftdev.ui.theme.UiTheme

/** Default metrics and styles of [AuthPrimaryButton] and [AuthLink]. */
public object AuthActionDefaults {
    /** Height of the primary button; the theme `mButton`. */
    public val buttonHeight: Dp
        @Composable @ReadOnlyComposable
        get() = UiTheme.sizes.mButton

    /** Label style of the primary button; the theme `mButton`. */
    public val buttonTextStyle: TextStyle
        @Composable @ReadOnlyComposable
        get() = UiTheme.typography.mButton

    /** Link style; the theme `mMeta`, underlined. */
    public val linkTextStyle: TextStyle
        @Composable @ReadOnlyComposable
        get() = UiTheme.typography.mMeta.copy(textDecoration = TextDecoration.Underline)

    /** Link color; `ink2` keeps 4.5:1 on the sheet. */
    public val linkColor: Color
        @Composable @ReadOnlyComposable
        get() = UiTheme.colors.ink2
}

/**
 * Full-width pill primary action of the sign-in family. [loading] shows the spinner and ignores taps (announcing
 * [loadingDescription]); [enabled] false swaps to the neutral disabled colors.
 */
@Composable
public fun AuthPrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false,
    loadingDescription: String? = null,
    colors: ButtonColors = ButtonDefaults.colors(ButtonVariant.Primary),
    textStyle: TextStyle = AuthActionDefaults.buttonTextStyle,
    height: Dp = AuthActionDefaults.buttonHeight,
) {
    Button(
        text,
        onClick,
        modifier,
        variant = ButtonVariant.Primary,
        block = true,
        enabled = enabled,
        loading = loading,
        loadingDescription = loadingDescription,
        colors = colors,
        shape = UiTheme.shapes.pill,
        height = height,
        textStyle = textStyle,
    )
}

/**
 * Small underlined text link ("Forgot password?", "New user? Sign up"). The text comes from the caller; the tap target is at
 * least 48dp. Place it with [modifier] (for example `Modifier.align(Alignment.End)`).
 */
@Composable
public fun AuthLink(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    color: Color = AuthActionDefaults.linkColor,
    textStyle: TextStyle = AuthActionDefaults.linkTextStyle,
) {
    val source = remember { MutableInteractionSource() }
    Text(text, modifier.pressableTarget(onClick, enabled, Role.Button, source), textStyle, color)
}
