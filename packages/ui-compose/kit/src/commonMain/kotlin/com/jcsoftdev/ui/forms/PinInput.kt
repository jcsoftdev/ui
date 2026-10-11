package com.jcsoftdev.ui.forms

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.autofill.ContentType
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.contentType
import androidx.compose.ui.semantics.error
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.atoms.DISABLED_ALPHA
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.theme.UiTheme
import com.jcsoftdev.ui.theme.UiTypography

private val PinKeyboard =
    KeyboardOptions(keyboardType = KeyboardType.NumberPassword, imeAction = ImeAction.Done, autoCorrectEnabled = false)

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
    onComplete: ((String) -> Unit)? = null,
) {
    val colors = UiTheme.colors
    val textStyle =
        UiTheme.text(UiTypography.clock).let {
            remember(it, colors.ink) { it.copy(color = colors.ink, textAlign = TextAlign.Center) }
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
        textStyle = textStyle,
        keyboardOptions = PinKeyboard,
        singleLine = true,
        visualTransformation = VisualTransformation.None,
        cursorBrush = SolidColor(colors.accent),
        decorationBox = { _ ->
            Row(
                Modifier.graphicsLayer { alpha = if (enabled) 1f else DISABLED_ALPHA },
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                for (index in 0 until length) {
                    val active = focused && index == value.length.coerceAtMost(length - 1)
                    Box(
                        Modifier
                            .widthIn(min = 40.dp)
                            .heightIn(min = 48.dp)
                            .drawBehind {
                                val radius = CornerRadius(12.dp.toPx())
                                drawRoundRect(colors.surface, cornerRadius = radius)
                                val line =
                                    if (isError) {
                                        colors.danger
                                    } else if (active) {
                                        colors.accent
                                    } else {
                                        colors.lineControl
                                    }
                                val width = if (active || isError) 2.dp.toPx() else 1.dp.toPx()
                                drawRoundRect(
                                    line,
                                    Offset(width / 2, width / 2),
                                    Size(size.width - width, size.height - width),
                                    radius,
                                    Stroke(width),
                                )
                            },
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(if (index < value.length) value[index].toString() else "", style = UiTypography.clock)
                    }
                }
            }
        },
    )
}
