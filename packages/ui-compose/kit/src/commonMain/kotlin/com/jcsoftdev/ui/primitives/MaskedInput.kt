package com.jcsoftdev.ui.primitives

import androidx.compose.runtime.Composable
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
 */
public fun filterDigits(
    text: String,
    maxLength: Int,
): String {
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
 * display text and [visualTransformation] the matching `VisualTransformation` with correct cursor mapping.
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
    }

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
 * ```
 * val mask = remember { DigitMask(4, ':', listOf(2)) }
 * val input = rememberMaskedInputState(value, onValueChange, mask, commit = { d -> if (d.length == 4) d else "" })
 * BasicTextField(input.digits, input::onInput, visualTransformation = input.visualTransformation)
 * ```
 */
@Stable
public class MaskedInputState internal constructor(
    public val mask: DigitMask,
) {
    private var commitValue: (String) -> String = { it }
    private var report: (String) -> Unit = {}

    /** Raw digits being edited; pass this to the text field. */
    public var digits: String by mutableStateOf("")
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
        if (value != commit(digits)) digits = mask.filter(value)
    }

    /** Handles typed [raw] text: keeps the digits and reports the committed value. */
    public fun onInput(raw: String) {
        val next = mask.filter(raw)
        digits = next
        report(commitValue(next))
    }
}

/**
 * Remembers a [MaskedInputState] for the committed [value]. [commit] turns the digits into the value reported through
 * [onValueChange] (for instance "" until a valid time was typed); by default the digits are reported only when complete.
 * When [value] changes from outside, the digits follow it.
 */
@Composable
public fun rememberMaskedInputState(
    value: String,
    onValueChange: (String) -> Unit,
    mask: DigitMask,
    commit: (String) -> String = { digits -> if (digits.length == mask.maxDigits) digits else "" },
): MaskedInputState {
    val state = remember(mask) { MaskedInputState(mask).also { it.bind(value, commit, onValueChange) } }
    state.bind(value, commit, onValueChange)
    return state
}
