package com.jcsoftdev.ui.forms

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.autofill.ContentType
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.contentType
import androidx.compose.ui.semantics.error
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.atoms.ButtonSize
import com.jcsoftdev.ui.atoms.IconButton
import com.jcsoftdev.ui.atoms.LocalContentColor
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.atoms.dimWhenDisabled
import com.jcsoftdev.ui.theme.UiTheme

/** Height of an [Input]: `Lg` matches the large button. */
public enum class InputSize { Md, Lg }

/** Colors of the text-like controls ([Input], [PasswordInput], [TimeInput], [DateInput], [Select], [PinInput]); [selectedOption] colors the chosen option in the [Select] list. */
@Immutable
public class InputColors(
    public val container: Color,
    public val border: Color,
    public val focusedBorder: Color,
    public val errorBorder: Color,
    public val text: Color,
    public val placeholder: Color,
    public val cursor: Color,
    public val selectedOption: Color = Color.Unspecified,
) {
    /** Copy with selected colors replaced. */
    public fun copy(
        container: Color = this.container,
        border: Color = this.border,
        focusedBorder: Color = this.focusedBorder,
        errorBorder: Color = this.errorBorder,
        text: Color = this.text,
        placeholder: Color = this.placeholder,
        cursor: Color = this.cursor,
        selectedOption: Color = this.selectedOption,
    ): InputColors = InputColors(container, border, focusedBorder, errorBorder, text, placeholder, cursor, selectedOption)
}

/**
 * What an [Input] holds, so autofill and password managers can offer the right saved value (Compose `contentType` semantics).
 * It only labels the field; it never changes the keyboard (use `keyboardOptions` for that) or the displayed text.
 */
public enum class InputContentType {
    Username,
    NewUsername,
    Email,
    Phone,
    Password,
    NewPassword,
    OneTimeCode,
}

@OptIn(ExperimentalComposeUiApi::class)
private fun InputContentType.toCompose(): ContentType =
    when (this) {
        InputContentType.Username -> ContentType.Username
        InputContentType.NewUsername -> ContentType.NewUsername
        InputContentType.Email -> ContentType.EmailAddress
        InputContentType.Phone -> ContentType.PhoneNumber
        InputContentType.Password -> ContentType.Password
        InputContentType.NewPassword -> ContentType.NewPassword
        InputContentType.OneTimeCode -> ContentType.SmsOtpCode
    }

/** Default colors, shape and metrics shared by the text-like controls; read the theme, so a custom [UiTheme] flows through. */
public object InputDefaults {
    /** Colors in the active theme; focus uses the accent, errors the danger color. */
    @Composable
    @ReadOnlyComposable
    public fun colors(): InputColors {
        val c = UiTheme.colors
        return InputColors(c.surface, c.lineControl, c.accent, c.danger, c.ink, c.ink3, c.accent, c.accentInk)
    }

    /** Corner shape; the theme `control` shape. */
    public val shape: Shape
        @Composable @ReadOnlyComposable
        get() = UiTheme.shapes.control

    /** Padding between the outline and the content. */
    public val contentPadding: PaddingValues = PaddingValues(horizontal = 12.dp)

    /** Gap between the leading slot, the text and the trailing slot. */
    public val spacing: Dp = 8.dp

    /** Text and placeholder style; the theme `body`. */
    public val textStyle: TextStyle
        @Composable @ReadOnlyComposable
        get() = UiTheme.typography.body

    /**
     * The eye on the [PasswordInput] toggle: `visible` is true while the password is shown, and the eye is then crossed.
     * Drawn in the surrounding content color; [PasswordInput]'s `visibilityIcon` replaces it.
     */
    public val VisibilityIcon: @Composable (visible: Boolean) -> Unit = { visible -> EyeGlyph(visible) }
}

/**
 * Single-line text input (a `BasicTextField` with `value` / `onValueChange`: the `TextFieldState` API is stable in
 * Compose Multiplatform 1.8.2, but its output transformations are still experimental, and the digit masks here need them).
 * Inside a [Field] it also reads the label, helper text and error. Minimum height 48dp (the large button's height for [InputSize.Lg]), grows with the font scale.
 *
 * [contentType] tells autofill and password managers what the field holds (username, e-mail, phone, one-time code...); it is
 * semantics only, so pair it with matching `keyboardOptions`. [placeholder] shows while empty, in the placeholder color.
 */
@Composable
public fun Input(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    readOnly: Boolean = false,
    isError: Boolean = false,
    placeholder: String? = null,
    contentDescription: String? = null,
    contentType: InputContentType? = null,
    leading: (@Composable () -> Unit)? = null,
    trailing: (@Composable () -> Unit)? = null,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    keyboardActions: KeyboardActions = KeyboardActions.Default,
    visualTransformation: VisualTransformation = VisualTransformation.None,
    colors: InputColors = InputDefaults.colors(),
    shape: Shape = InputDefaults.shape,
    contentPadding: PaddingValues = InputDefaults.contentPadding,
    textStyle: TextStyle = InputDefaults.textStyle,
    size: InputSize = InputSize.Md,
) {
    InputFrame(
        value,
        onValueChange,
        modifier,
        enabled,
        readOnly,
        isError,
        placeholder,
        contentDescription,
        leading,
        trailing,
        keyboardOptions,
        keyboardActions,
        visualTransformation,
        colors,
        shape,
        contentPadding,
        textStyle,
        size,
        contentType,
    )
}

/**
 * [Input] for secrets: masked by default, with a show/hide button whose labels the caller supplies. [contentType] is
 * [InputContentType.Password]; pass [InputContentType.NewPassword] on sign-up and change-password screens so the password manager
 * offers to generate one instead of filling the saved one.
 */
@Composable
public fun PasswordInput(
    value: String,
    onValueChange: (String) -> Unit,
    showLabel: String = UiTheme.strings.showPassword,
    hideLabel: String = UiTheme.strings.hidePassword,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    isError: Boolean = false,
    placeholder: String? = null,
    contentDescription: String? = null,
    contentType: InputContentType = InputContentType.Password,
    keyboardActions: KeyboardActions = KeyboardActions.Default,
    colors: InputColors = InputDefaults.colors(),
    shape: Shape = InputDefaults.shape,
    contentPadding: PaddingValues = InputDefaults.contentPadding,
    textStyle: TextStyle = InputDefaults.textStyle,
    visibilityIcon: @Composable (visible: Boolean) -> Unit = InputDefaults.VisibilityIcon,
) {
    var visible by remember { mutableStateOf(false) }
    InputFrame(
        value,
        onValueChange,
        modifier,
        enabled,
        false,
        isError,
        placeholder,
        contentDescription,
        null,
        {
            IconButton({ visible = !visible }, if (visible) hideLabel else showLabel, size = ButtonSize.Sm, enabled = enabled) {
                visibilityIcon(visible)
            }
        },
        PasswordKeyboard,
        keyboardActions,
        if (visible) VisualTransformation.None else PasswordVisualTransformation(),
        colors,
        shape,
        contentPadding,
        textStyle,
        contentType = contentType,
    )
}

private val PasswordKeyboard = KeyboardOptions(keyboardType = KeyboardType.Password, autoCorrectEnabled = false, imeAction = ImeAction.Done)

@Composable
private fun EyeGlyph(crossed: Boolean) {
    val color = LocalContentColor.current
    Box(
        Modifier.size(20.dp).drawBehind {
            val stroke = 1.6.dp.toPx()
            val eyeHeight = size.height * 0.5f
            drawOval(
                color,
                Offset(1.dp.toPx(), (size.height - eyeHeight) / 2),
                Size(size.width - 2.dp.toPx(), eyeHeight),
                style = Stroke(stroke),
            )
            drawCircle(color, size.width * 0.12f)
            if (crossed) {
                drawLine(
                    color,
                    Offset(size.width * 0.15f, size.height * 0.85f),
                    Offset(size.width * 0.85f, size.height * 0.15f),
                    stroke,
                    StrokeCap.Round,
                )
            }
        },
    )
}

/** Shared by every text-like control: border, focus ring, leading and trailing slots, placeholder. */
@Composable
internal fun InputFrame(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier,
    enabled: Boolean,
    readOnly: Boolean,
    isError: Boolean,
    placeholder: String?,
    contentDescription: String?,
    leading: (@Composable () -> Unit)?,
    trailing: (@Composable () -> Unit)?,
    keyboardOptions: KeyboardOptions,
    keyboardActions: KeyboardActions,
    visualTransformation: VisualTransformation,
    colors: InputColors,
    shape: Shape,
    contentPadding: PaddingValues,
    textStyle: TextStyle,
    size: InputSize = InputSize.Md,
    contentType: InputContentType? = null,
) {
    val sizes = UiTheme.sizes
    val info = LocalFieldInfo.current
    val hasError = isError || info?.error != null
    val fieldStyle = UiTheme.text(textStyle).let { remember(it, colors.text) { it.copy(color = colors.text) } }
    var focused by remember { mutableStateOf(false) }
    val spoken = contentDescription ?: info?.spoken
    val errorText = info?.error
    BasicTextField(
        value = value,
        onValueChange = onValueChange,
        modifier =
            modifier
                .onFocusChanged { focused = it.isFocused }
                .semantics {
                    if (spoken != null) this.contentDescription = spoken
                    if (hasError) error(errorText ?: "")
                    if (contentType != null) this.contentType = contentType.toCompose()
                },
        enabled = enabled,
        readOnly = readOnly,
        textStyle = fieldStyle,
        keyboardOptions = keyboardOptions,
        keyboardActions = keyboardActions,
        singleLine = true,
        visualTransformation = visualTransformation,
        cursorBrush = SolidColor(colors.cursor),
        decorationBox = { inner ->
            val line =
                if (hasError) {
                    colors.errorBorder
                } else if (focused) {
                    colors.focusedBorder
                } else {
                    colors.border
                }
            Row(
                Modifier
                    .dimWhenDisabled(enabled)
                    .heightIn(min = if (size == InputSize.Lg) maxOf(sizes.minTouchTarget, sizes.controlHeightLg) else sizes.minTouchTarget)
                    .clip(shape)
                    .background(colors.container)
                    .border(if (focused || hasError) sizes.focusBorderWidth else sizes.borderWidth, line, shape)
                    .padding(contentPadding),
                horizontalArrangement = Arrangement.spacedBy(InputDefaults.spacing),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (leading != null) leading()
                Box(Modifier.weight(1f), contentAlignment = Alignment.CenterStart) {
                    if (value.isEmpty() && placeholder != null) Text(placeholder, style = textStyle, color = colors.placeholder)
                    inner()
                }
                if (trailing != null) trailing()
            }
        },
    )
}
