package com.jcsoftdev.ui.forms

import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType

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
) {
    var digits by remember { mutableStateOf(digitsOnly(value, TimeFormat.DIGITS)) }
    if (value != TimeFormat.commit(digits)) digits = digitsOnly(value, TimeFormat.DIGITS)
    InputFrame(
        digits,
        {
            val next = digitsOnly(it, TimeFormat.DIGITS)
            digits = next
            onValueChange(TimeFormat.commit(next))
        },
        modifier,
        enabled,
        false,
        isError || (digits.length == TimeFormat.DIGITS && value.isEmpty()),
        placeholder,
        contentDescription,
        null,
        null,
        NumberPad,
        keyboardActions,
        TimeTransformation,
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
) {
    var digits by remember { mutableStateOf(digitsOnly(value, DateFormat.DIGITS)) }
    if (value != DateFormat.commit(digits)) digits = digitsOnly(value, DateFormat.DIGITS)
    InputFrame(
        digits,
        {
            val next = digitsOnly(it, DateFormat.DIGITS)
            digits = next
            onValueChange(DateFormat.commit(next))
        },
        modifier,
        enabled,
        false,
        isError || (digits.length == DateFormat.DIGITS && value.isEmpty()),
        placeholder,
        contentDescription,
        null,
        null,
        NumberPad,
        keyboardActions,
        DateTransformation,
    )
}
