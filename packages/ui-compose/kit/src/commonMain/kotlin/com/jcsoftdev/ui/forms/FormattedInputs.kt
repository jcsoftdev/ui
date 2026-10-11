package com.jcsoftdev.ui.forms

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import com.jcsoftdev.ui.primitives.rememberMaskedInputState

private val NumberPad = KeyboardOptions(keyboardType = KeyboardType.Number, imeAction = ImeAction.Done, autoCorrectEnabled = false)

/**
 * 24h time field. The user types digits on the number pad and the ":" appears by itself ("0930" shows "09:30").
 * [value] is "HH:mm" or "" and [onValueChange] reports "HH:mm" once the four digits are a real time, "" otherwise.
 */
@Composable
public fun TimeInput(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    isError: Boolean = false,
    placeholder: String? = null,
    contentDescription: String? = null,
    keyboardActions: KeyboardActions = KeyboardActions.Default,
    colors: InputColors = InputDefaults.colors(),
    shape: Shape = InputDefaults.shape,
    contentPadding: PaddingValues = InputDefaults.contentPadding,
    textStyle: TextStyle = InputDefaults.textStyle,
) {
    val input = rememberMaskedInputState(value, onValueChange, TimeMask, TimeFormat::commit)
    InputFrame(
        input.digits,
        input::onInput,
        modifier,
        enabled,
        false,
        isError || (input.isComplete && value.isEmpty()),
        placeholder,
        contentDescription,
        null,
        null,
        NumberPad,
        keyboardActions,
        input.visualTransformation,
        colors,
        shape,
        contentPadding,
        textStyle,
    )
}

/**
 * Date field in "dd/MM/yyyy" with the same digit-only typing. [onValueChange] reports a date only when the eight
 * digits are a real calendar day (leap years included), "" otherwise; the field turns to its error state when
 * complete but impossible, such as 31/02/2024.
 */
@Composable
public fun DateInput(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    isError: Boolean = false,
    placeholder: String? = null,
    contentDescription: String? = null,
    keyboardActions: KeyboardActions = KeyboardActions.Default,
    colors: InputColors = InputDefaults.colors(),
    shape: Shape = InputDefaults.shape,
    contentPadding: PaddingValues = InputDefaults.contentPadding,
    textStyle: TextStyle = InputDefaults.textStyle,
) {
    val input = rememberMaskedInputState(value, onValueChange, DateMask, DateFormat::commit)
    InputFrame(
        input.digits,
        input::onInput,
        modifier,
        enabled,
        false,
        isError || (input.isComplete && value.isEmpty()),
        placeholder,
        contentDescription,
        null,
        null,
        NumberPad,
        keyboardActions,
        input.visualTransformation,
        colors,
        shape,
        contentPadding,
        textStyle,
    )
}
