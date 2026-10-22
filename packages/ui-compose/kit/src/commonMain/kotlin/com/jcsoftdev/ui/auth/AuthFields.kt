package com.jcsoftdev.ui.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.atoms.IconButton
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.forms.FieldInfo
import com.jcsoftdev.ui.forms.Input
import com.jcsoftdev.ui.forms.InputColors
import com.jcsoftdev.ui.forms.InputContentType
import com.jcsoftdev.ui.forms.InputDefaults
import com.jcsoftdev.ui.forms.InputSize
import com.jcsoftdev.ui.forms.LocalFieldInfo
import com.jcsoftdev.ui.icons.Icon
import com.jcsoftdev.ui.icons.Icons
import com.jcsoftdev.ui.icons.Lock
import com.jcsoftdev.ui.icons.User
import com.jcsoftdev.ui.theme.UiTheme

/** Colors of the auth fields: the soft [container], the [focusedRing] shown while editing, the [errorRing] and [error] text, the [text] and [placeholder], and the leading [icon]. */
@Immutable
public class AuthFieldColors(
    public val container: Color,
    public val focusedRing: Color,
    public val errorRing: Color,
    public val error: Color,
    public val text: Color,
    public val placeholder: Color,
    public val icon: Color,
) {
    /** Copy with selected colors replaced. */
    public fun copy(
        container: Color = this.container,
        focusedRing: Color = this.focusedRing,
        errorRing: Color = this.errorRing,
        error: Color = this.error,
        text: Color = this.text,
        placeholder: Color = this.placeholder,
        icon: Color = this.icon,
    ): AuthFieldColors = AuthFieldColors(container, focusedRing, errorRing, error, text, placeholder, icon)
}

/** Default colors, shape and metrics of [AuthTextField] and [AuthPasswordField]. */
public object AuthFieldDefaults {
    /** A soft filled container with no resting border; the ring appears on focus and on error so state never depends on the fill alone. */
    @Composable
    @ReadOnlyComposable
    public fun colors(): AuthFieldColors {
        val c = UiTheme.colors
        return AuthFieldColors(lerp(c.surface2, c.accentSoft, 0.25f), c.accent, c.danger, c.danger, c.ink, c.ink3, c.ink3)
    }

    /** Pill shape. */
    public val shape: Shape
        @Composable @ReadOnlyComposable
        get() = UiTheme.shapes.pill

    /** Text style; the theme `mBody`. */
    public val textStyle: TextStyle
        @Composable @ReadOnlyComposable
        get() = UiTheme.typography.mBody

    /** Padding inside the pill. */
    public val contentPadding: PaddingValues = PaddingValues(horizontal = 20.dp)

    /** Size of the leading icon. */
    public val iconSize: Dp = 24.dp

    /** Gap between stacked fields; use it as the arrangement of the column that holds them. */
    public val rhythm: Dp
        @Composable @ReadOnlyComposable
        get() = UiTheme.sizes.space18

    /** The keyboard of an identifier field: e-mail layout, no autocorrect, `Next`. */
    public val IdKeyboard: KeyboardOptions =
        KeyboardOptions(keyboardType = KeyboardType.Email, autoCorrectEnabled = false, imeAction = ImeAction.Next)

    /** The keyboard of a password field: masked, no autocorrect, `Done`. */
    public val PasswordKeyboard: KeyboardOptions =
        KeyboardOptions(keyboardType = KeyboardType.Password, autoCorrectEnabled = false, imeAction = ImeAction.Done)
}

/**
 * Filled pill field for an identifier (e-mail, user name, student id), 52dp high with a 24dp [leadingIcon] and a [placeholder]
 * (default [label]). [label] is what screen readers announce, since the placeholder disappears once typing starts. A non-null
 * [error] marks the field invalid and shows the message under it (an empty string marks it without a message). Focus: attach
 * `Modifier.onFocusChanged` to [modifier] to learn it.
 */
@Composable
public fun AuthTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    error: String? = null,
    placeholder: String? = label,
    leadingIcon: ImageVector? = Icons.User,
    contentType: InputContentType = InputContentType.Username,
    keyboardOptions: KeyboardOptions = AuthFieldDefaults.IdKeyboard,
    keyboardActions: KeyboardActions = KeyboardActions.Default,
    colors: AuthFieldColors = AuthFieldDefaults.colors(),
    shape: Shape = AuthFieldDefaults.shape,
    textStyle: TextStyle = AuthFieldDefaults.textStyle,
) {
    AuthFieldFrame(error, colors, modifier) {
        CompositionLocalProvider(LocalFieldInfo provides FieldInfo(label, null, error)) {
            Input(
                value,
                onValueChange,
                Modifier,
                enabled,
                isError = error != null,
                placeholder = placeholder,
                contentType = contentType,
                leading = leadingIcon?.let { icon -> { Icon(icon, null, tint = colors.icon, size = AuthFieldDefaults.iconSize) } },
                keyboardOptions = keyboardOptions,
                keyboardActions = keyboardActions,
                colors = colors.toInputColors(),
                shape = shape,
                contentPadding = AuthFieldDefaults.contentPadding,
                textStyle = textStyle,
                size = InputSize.Lg,
            )
        }
    }
}

/**
 * [AuthTextField] for the password: masked by default, with a 24dp lock and a trailing reveal button whose labels default to
 * `UiTheme.strings.showPassword` / `hidePassword`. [contentType] is [InputContentType.Password]; pass `NewPassword` on sign-up.
 */
@Composable
public fun AuthPasswordField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    error: String? = null,
    placeholder: String? = label,
    leadingIcon: ImageVector? = Icons.Lock,
    showLabel: String = UiTheme.strings.showPassword,
    hideLabel: String = UiTheme.strings.hidePassword,
    contentType: InputContentType = InputContentType.Password,
    keyboardOptions: KeyboardOptions = AuthFieldDefaults.PasswordKeyboard,
    keyboardActions: KeyboardActions = KeyboardActions.Default,
    colors: AuthFieldColors = AuthFieldDefaults.colors(),
    shape: Shape = AuthFieldDefaults.shape,
    textStyle: TextStyle = AuthFieldDefaults.textStyle,
) {
    var visible by remember { mutableStateOf(false) }
    AuthFieldFrame(error, colors, modifier) {
        CompositionLocalProvider(LocalFieldInfo provides FieldInfo(label, null, error)) {
            Input(
                value,
                onValueChange,
                Modifier,
                enabled,
                isError = error != null,
                placeholder = placeholder,
                contentType = contentType,
                leading = leadingIcon?.let { icon -> { Icon(icon, null, tint = colors.icon, size = AuthFieldDefaults.iconSize) } },
                trailing = {
                    IconButton({ visible = !visible }, if (visible) hideLabel else showLabel, enabled = enabled) {
                        InputDefaults.VisibilityIcon(visible)
                    }
                },
                keyboardOptions = keyboardOptions,
                keyboardActions = keyboardActions,
                visualTransformation = if (visible) VisualTransformation.None else PasswordVisualTransformation(),
                colors = colors.toInputColors(),
                shape = shape,
                contentPadding = AuthFieldDefaults.contentPadding,
                textStyle = textStyle,
                size = InputSize.Lg,
            )
        }
    }
}

@Composable
private fun AuthFieldFrame(
    error: String?,
    colors: AuthFieldColors,
    modifier: Modifier,
    field: @Composable () -> Unit,
) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(UiTheme.sizes.space6)) {
        field()
        if (!error.isNullOrEmpty()) {
            Text(
                error,
                Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                UiTheme.typography.mMeta,
                colors.error,
            )
        }
    }
}

private fun AuthFieldColors.toInputColors(): InputColors =
    InputColors(container, Color.Transparent, focusedRing, errorRing, text, placeholder, focusedRing)
