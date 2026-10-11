package com.jcsoftdev.ui.primitives

import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.input.OffsetMapping
import androidx.compose.ui.text.input.TransformedText
import androidx.compose.ui.text.input.VisualTransformation

/**
 * Keeps the digits of [text] (at most [maxLength] of them) and drops everything else, so a field stores raw digits and the
 * separators exist only on screen.
 *
 * ```
 * filterDigits("09:30", maxLength = 4) // "0930"
 * ```
 *
 * A [maxLength] of 0 always gives "" and a negative one is rejected.
 */
public fun filterDigits(
    text: String,
    maxLength: Int,
): String {
    require(maxLength >= 0) { "maxLength must not be negative" }
    if (maxLength == 0) return ""
    var allDigits = text.length <= maxLength
    for (ch in text) if (ch !in '0'..'9') allDigits = false
    if (allDigits) return text
    val out = StringBuilder(maxLength)
    for (ch in text) {
        if (ch in '0'..'9') {
            out.append(ch)
            if (out.length == maxLength) break
        }
    }
    return out.toString()
}

/**
 * A digits-only mask of at most [maxDigits] digits that shows [separator] before the raw digit offsets in
 * [separatorAt] (`DigitMask(4, ':', listOf(2))` shows "0930" as "09:30"). [filter] is the input filter, [format] the
 * display text and [visualTransformation] the matching `VisualTransformation` with correct cursor mapping. The offsets must
 * be distinct and fall inside the digits (1 until [maxDigits]); anything else is rejected. Two masks with the same digits,
 * separator and offsets are equal.
 */
@Stable
public class DigitMask(
    public val maxDigits: Int,
    public val separator: Char,
    separatorAt: List<Int>,
) {
    private val positions: List<Int> = separatorAt.sorted()

    init {
        require(maxDigits >= 1) { "maxDigits must be at least 1" }
        require(positions.all { it in 1 until maxDigits }) { "separator offsets must fall inside the digits" }
        require(positions.distinct().size == positions.size) { "separator offsets must be distinct" }
    }

    override fun equals(other: Any?): Boolean =
        other is DigitMask && other.maxDigits == maxDigits && other.separator == separator && other.positions == positions

    override fun hashCode(): Int = 31 * (31 * maxDigits + separator.hashCode()) + positions.hashCode()

    /** Keeps only the digits of [text], at most [maxDigits]. */
    public fun filter(text: String): String = filterDigits(text, maxDigits)

    /** The text shown for raw [digits]: "0930" becomes "09:30", "093" becomes "09:3". */
    public fun format(digits: String): String {
        val out = StringBuilder(digits.length + positions.size)
        for (i in digits.indices) {
            if (i in positions) out.append(separator)
            out.append(digits[i])
        }
        return out.toString()
    }

    private val mapping =
        object : OffsetMapping {
            override fun originalToTransformed(offset: Int): Int = offset + positions.count { offset > it }

            override fun transformedToOriginal(offset: Int): Int =
                (offset - positions.withIndex().count { (k, p) -> offset > p + k }).coerceAtLeast(0)
        }

    /** Shows the separators without storing them. */
    public val visualTransformation: VisualTransformation =
        VisualTransformation { text -> TransformedText(AnnotatedString(format(text.text)), mapping) }
}

/**
 * State of a masked text field: the raw [digits] it edits, kept in step with the committed value. [onInput] takes what the
 * user typed (any characters), filters it through the [DigitMask] and reports the committed value.
 *
 * A partial entry commits as "" by default, which is also what an empty field reports, so the parent cannot clear it by
 * passing "" again; call [reset] (or [replaceDigits]) for that. A parent value that changes to anything else, including from a
 * complete value to "", is followed by the digits.
 *
 * ```
 * val mask = remember { DigitMask(4, ':', listOf(2)) }
 * val input = rememberMaskedInputState(value, onValueChange, mask, commit = { d -> if (d.length == 4) d else "" })
 * BasicTextField(input.digits, input::onInput, visualTransformation = input.visualTransformation)
 * Button(onClick = input::reset) { Text("Clear") }
 * ```
 */
@Stable
public class MaskedInputState internal constructor(
    public val mask: DigitMask,
    initialValue: String,
    private var commitValue: (String) -> String,
    private var report: (String) -> Unit,
) {
    private var lastValue: String = initialValue

    /** Raw digits being edited; pass this to the text field. */
    public var digits: String by mutableStateOf(mask.filter(initialValue))
        private set

    /** `VisualTransformation` that shows the separators. */
    public val visualTransformation: VisualTransformation get() = mask.visualTransformation

    /** True when all [DigitMask.maxDigits] digits were typed. */
    public val isComplete: Boolean get() = digits.length == mask.maxDigits

    internal fun bind(
        value: String,
        commit: (String) -> String,
        onValueChange: (String) -> Unit,
    ) {
        commitValue = commit
        report = onValueChange
        if (value != lastValue) {
            lastValue = value
            digits = mask.filter(value)
        }
    }

    /** Handles typed [raw] text: keeps the digits and reports the committed value. */
    public fun onInput(raw: String) {
        val next = mask.filter(raw)
        digits = next
        val committed = commitValue(next)
        lastValue = committed
        report(committed)
    }

    /** Replaces the digits with those of [raw] (filtered like typed text) and reports the committed value. */
    public fun replaceDigits(raw: String) {
        onInput(raw)
    }

    /** Clears the field, including a partial entry, and reports the committed value of no digits. */
    public fun reset() {
        onInput("")
    }
}

/**
 * Remembers a [MaskedInputState] for the committed [value]. [commit] turns the digits into the value reported through
 * [onValueChange] (for instance "" until a valid time was typed); by default the digits are reported only when complete.
 * When [value] changes from outside, the digits follow it (one frame later, because the state is only written after the
 * composition, never during it); use [MaskedInputState.reset] to clear a partial entry.
 */
@Composable
public fun rememberMaskedInputState(
    value: String,
    onValueChange: (String) -> Unit,
    mask: DigitMask,
    commit: (String) -> String = { digits -> if (digits.length == mask.maxDigits) digits else "" },
): MaskedInputState {
    val state = remember(mask) { MaskedInputState(mask, value, commit, onValueChange) }
    SideEffect { state.bind(value, commit, onValueChange) }
    return state
}
