package com.jcsoftdev.ui.forms

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.error
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.atoms.ButtonSize
import com.jcsoftdev.ui.atoms.DISABLED_ALPHA
import com.jcsoftdev.ui.atoms.IconButton
import com.jcsoftdev.ui.atoms.LocalContentColor
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.theme.UiShapes
import com.jcsoftdev.ui.theme.UiTheme
import com.jcsoftdev.ui.theme.UiTypography

internal const val DISABLED_ALPHA = 0.45f

/**
 * Single-line text input (a `BasicTextField` with `value` / `onValueChange`: the `TextFieldState` API is stable in
 * Compose Multiplatform 1.8.2, but its output transformations are still experimental, and the digit masks here need them).
 * Inside a [Field] it also reads the label, helper text and error. Minimum height 48dp, grows with the font scale.
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
    leading: (@Composable () -> Unit)? = null,
    trailing: (@Composable () -> Unit)? = null,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    keyboardActions: KeyboardActions = KeyboardActions.Default,
    visualTransformation: VisualTransformation = VisualTransformation.None,
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
    )
}

/** [Input] for secrets: masked by default, with a show/hide button whose labels the caller supplies. */
@Composable
public fun PasswordInput(
    value: String,
    onValueChange: (String) -> Unit,
    showLabel: String,
    hideLabel: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    isError: Boolean = false,
    placeholder: String? = null,
    contentDescription: String? = null,
    keyboardActions: KeyboardActions = KeyboardActions.Default,
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
                EyeGlyph(visible)
            }
        },
        PasswordKeyboard,
        keyboardActions,
        if (visible) VisualTransformation.None else PasswordVisualTransformation(),
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
) {
    val colors = UiTheme.colors
    val info = LocalFieldInfo.current
    val hasError = isError || info?.error != null
    val textStyle = UiTheme.text(UiTypography.body).let { remember(it, colors.ink) { it.copy(color = colors.ink) } }
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
                },
        enabled = enabled,
        readOnly = readOnly,
        textStyle = textStyle,
        keyboardOptions = keyboardOptions,
        keyboardActions = keyboardActions,
        singleLine = true,
        visualTransformation = visualTransformation,
        cursorBrush = SolidColor(colors.accent),
        decorationBox = { inner ->
            Row(
                Modifier
                    .graphicsLayer { alpha = if (enabled) 1f else DISABLED_ALPHA }
                    .heightIn(min = 48.dp)
                    .clip(UiShapes.control)
                    .drawBehind {
                        val radius = CornerRadius(12.dp.toPx())
                        drawRoundRect(colors.surface, cornerRadius = radius)
                        val line =
                            if (hasError) {
                                colors.danger
                            } else if (focused) {
                                colors.accent
                            } else {
                                colors.lineControl
                            }
                        val width = if (focused || hasError) 2.dp.toPx() else 1.dp.toPx()
                        val inset = width / 2
                        drawRoundRect(line, Offset(inset, inset), Size(size.width - width, size.height - width), radius, Stroke(width))
                    }.padding(horizontal = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (leading != null) leading()
                Box(Modifier.weight(1f), contentAlignment = Alignment.CenterStart) {
                    if (value.isEmpty() && placeholder != null) Text(placeholder, style = UiTypography.body, color = colors.ink3)
                    inner()
                }
                if (trailing != null) trailing()
            }
        },
    )
}
