package com.jcsoftdev.ui.forms

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.contentType
import androidx.compose.ui.semantics.error
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.atoms.dimWhenDisabled
import com.jcsoftdev.ui.theme.UiTheme

private val PinKeyboard =
    KeyboardOptions(keyboardType = KeyboardType.NumberPassword, imeAction = ImeAction.Done, autoCorrectEnabled = false)

/** Default metrics and text style of [PinInput]; it shares [InputDefaults.colors] and [InputDefaults.shape]. */
public object PinInputDefaults {
    /** Minimum size of one cell. */
    public val cellSize: DpSize
        @Composable @ReadOnlyComposable
        get() = DpSize(40.dp, UiTheme.sizes.minTouchTarget)

    /** Gap between cells. */
    public val spacing: Dp = 8.dp

    /** Digit style; the theme `clock`. */
    public val textStyle: TextStyle
        @Composable @ReadOnlyComposable
        get() = UiTheme.typography.clock
}

/**
 * One-time code entry with [length] cells. A single hidden text field holds the digits, so typing, deleting, pasting a
 * whole code and the platform's SMS autofill (`ContentType.SmsOtpCode`) all go through one `onValueChange`.
 * [onComplete] runs once when the last cell is filled.
 */
@OptIn(ExperimentalComposeUiApi::class)
@Composable
public fun PinInput(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    length: Int = 6,
    enabled: Boolean = true,
    isError: Boolean = false,
    contentDescription: String? = null,
    colors: InputColors = InputDefaults.colors(),
    shape: Shape = InputDefaults.shape,
    cellSize: DpSize = PinInputDefaults.cellSize,
    spacing: Dp = PinInputDefaults.spacing,
    textStyle: TextStyle = PinInputDefaults.textStyle,
    onComplete: ((String) -> Unit)? = null,
) {
    val sizes = UiTheme.sizes
    val fieldStyle =
        UiTheme.text(textStyle).let {
            remember(it, colors.text) { it.copy(color = colors.text, textAlign = TextAlign.Center) }
        }
    var focused by remember { mutableStateOf(false) }
    BasicTextField(
        value = value,
        onValueChange = { raw ->
            val next = digitsOnly(raw, length)
            if (next != value) {
                onValueChange(next)
                if (next.length == length) onComplete?.invoke(next)
            }
        },
        modifier =
            modifier
                .onFocusChanged { focused = it.isFocused }
                .semantics {
                    contentType = ContentType.SmsOtpCode
                    if (contentDescription != null) this.contentDescription = contentDescription
                    if (isError) error("")
                },
        enabled = enabled,
        textStyle = fieldStyle,
        keyboardOptions = PinKeyboard,
        singleLine = true,
        visualTransformation = VisualTransformation.None,
        cursorBrush = SolidColor(colors.cursor),
        decorationBox = { _ ->
            Row(
                Modifier.dimWhenDisabled(enabled),
                horizontalArrangement = Arrangement.spacedBy(spacing),
            ) {
                for (index in 0 until length) {
                    val active = focused && index == value.length.coerceAtMost(length - 1)
                    val line =
                        if (isError) {
                            colors.errorBorder
                        } else if (active) {
                            colors.focusedBorder
                        } else {
                            colors.border
                        }
                    Box(
                        Modifier
                            .widthIn(min = cellSize.width)
                            .heightIn(min = cellSize.height)
                            .clip(shape)
                            .background(colors.container)
                            .border(if (active || isError) sizes.focusBorderWidth else sizes.borderWidth, line, shape),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(if (index < value.length) value[index].toString() else "", style = textStyle, color = colors.text)
                    }
                }
            }
        },
    )
}
