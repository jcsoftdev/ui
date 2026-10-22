package com.jcsoftdev.ui.chart.core

import kotlin.jvm.JvmInline
import kotlin.math.abs
import kotlin.math.cbrt
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow

/** An sRGB colour packed as `0xAARRGGBB`. chart-core has no Compose, so the renderer converts this to its own `Color`. */
@JvmInline
public value class ChartColor(
    public val argb: Int,
) {
    public val alpha: Int get() = argb ushr 24
    public val red: Int get() = (argb shr 16) and 0xFF
    public val green: Int get() = (argb shr 8) and 0xFF
    public val blue: Int get() = argb and 0xFF

    public fun toHex(): String =
        buildString {
            append('#')
            for (v in intArrayOf(red, green, blue) + (if (alpha == 255) intArrayOf() else intArrayOf(alpha))) {
                append("0123456789abcdef"[v shr 4]).append("0123456789abcdef"[v and 15])
            }
        }

    public companion object {
        public fun rgb(
            red: Int,
            green: Int,
            blue: Int,
            alpha: Int = 255,
        ): ChartColor =
            ChartColor(
                (alpha.coerceIn(0, 255) shl 24) or (red.coerceIn(0, 255) shl 16) or (green.coerceIn(0, 255) shl 8) or blue.coerceIn(0, 255),
            )

        /** Parses `#rgb`, `#rrggbb` or `#rrggbbaa`; anything else throws, so a malformed accent cannot reach a style silently. */
        public fun parse(text: String): ChartColor {
            require(text.startsWith("#")) { "colour must start with #: $text" }
            val digits = text.substring(1)
            require(digits.all { it in '0'..'9' || it in 'a'..'f' || it in 'A'..'F' }) { "not a hex colour: $text" }
            return when (digits.length) {
                3 -> rgb(digits[0].digitToInt(16) * 17, digits[1].digitToInt(16) * 17, digits[2].digitToInt(16) * 17)
                6 -> rgb(digits.substring(0, 2).toInt(16), digits.substring(2, 4).toInt(16), digits.substring(4, 6).toInt(16))
                8 ->
                    rgb(
                        digits.substring(0, 2).toInt(16),
                        digits.substring(2, 4).toInt(16),
                        digits.substring(4, 6).toInt(16),
                        digits.substring(6, 8).toInt(16),
                    )
                else -> throw IllegalArgumentException("not a #rgb, #rrggbb or #rrggbbaa colour: $text")
            }
        }
    }
}

/** Where a series colour comes from. The first series wears the brand; the rest are the categorical `chartCat1..7` tokens. */
public enum class PaletteSlot { Accent, Cat1, Cat2, Cat3, Cat4, Cat5, Cat6, Cat7 }

/** Slot of the series at [index], wrapping around the eight slots. A negative index counts from the end of the cycle. */
public fun paletteSlot(index: Int): PaletteSlot = PaletteSlot.entries[index.mod(PaletteSlot.entries.size)]

public enum class ChartDirection { Up, Down, Flat }

/** Up, down or flat for a change; changes within [epsilon] count as flat. A `NaN` change is flat. */
public fun directionOf(
    delta: Double,
    epsilon: Double = 0.0,
): ChartDirection =
    when {
        delta > epsilon -> ChartDirection.Up
        delta < -epsilon -> ChartDirection.Down
        else -> ChartDirection.Flat
    }

public enum class ChartTone { Neutral, Accent, Danger, Warning, Success }

/**
 * Share (0-100) of the base colour in monochrome shade [step] of [count]: step 0 is the full colour, the last step the palest tint
 * (40%), mixed towards the surface so it works in both themes. A count of 1 gives 100.
 */
public fun monochromeShare(
    step: Int,
    count: Int,
): Int {
    val last = max(1, count - 1)
    return floor(100 - min(max(step, 0), last).toDouble() / last * 60 + 0.5).toInt()
}

/** Shares for [values], full on the largest value so rank reads as intensity; ties keep input order, `NaN` ranks last. */
public fun monochromeSharesByValue(values: DoubleArray): IntArray {
    val order =
        values.indices.sortedWith(
            compareBy<Int> { if (values[it].isNaN()) 1 else 0 }
                .thenByDescending {
                    values[it].let { v ->
                        if (v.isNaN()) 0.0 else v
                    }
                }.thenBy { it },
        )
    val out = IntArray(values.size)
    order.forEachIndexed { rank, index -> out[index] = monochromeShare(rank, values.size) }
    return out
}

// OKLab, the space CSS `color-mix(in oklab, ...)` interpolates in, so a tint here is the colour the web chart shows.
private fun toLinear(channel: Int): Double {
    val c = channel / 255.0
    return if (c <= 0.04045) c / 12.92 else ((c + 0.055) / 1.055).pow(2.4)
}

private fun fromLinear(value: Double): Int {
    val c = if (value <= 0.0031308) value * 12.92 else 1.055 * value.pow(1 / 2.4) - 0.055
    return floor(min(1.0, max(0.0, c)) * 255 + 0.5).toInt()
}

private class Lab(
    val l: Double,
    val a: Double,
    val b: Double,
)

private fun ChartColor.lab(): Lab {
    val r = toLinear(red)
    val g = toLinear(green)
    val bl = toLinear(blue)
    val l = cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * bl)
    val m = cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * bl)
    val s = cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * bl)
    return Lab(
        0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
        1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
        0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
    )
}

private fun Lab.toColor(alpha: Int): ChartColor {
    val l = (l + 0.3963377774 * a + 0.2158037573 * b).pow(3)
    val m = (this.l - 0.1055613458 * a - 0.0638541728 * b).pow(3)
    val s = (this.l - 0.0894841775 * a - 1.2914855480 * b).pow(3)
    return ChartColor.rgb(
        fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
        fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
        fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s),
        alpha,
    )
}

/** Whole percent a tint uses: [percent] clamped to 0-100 and rounded half up, as `color-mix` is written on the web. */
public fun tintPercent(percent: Double): Int = if (percent.isNaN()) 0 else floor(min(100.0, max(0.0, percent)) + 0.5).toInt()

/** Mixes [percent]% of [color] into [base] in OKLab (premultiplied alpha), like CSS `color-mix(in oklab, color p%, base)`. */
public fun tint(
    color: ChartColor,
    percent: Double,
    base: ChartColor,
): ChartColor {
    val p = tintPercent(percent)
    if (p >= 100) return color
    if (p <= 0) return base
    val w1 = p / 100.0
    val w2 = 1 - w1
    val a1 = color.alpha / 255.0
    val a2 = base.alpha / 255.0
    val alpha = a1 * w1 + a2 * w2
    if (alpha <= 0) return ChartColor(0)
    val c1 = color.lab()
    val c2 = base.lab()
    val k1 = a1 * w1 / alpha
    val k2 = a2 * w2 / alpha
    return Lab(c1.l * k1 + c2.l * k2, c1.a * k1 + c2.a * k2, c1.b * k1 + c2.b * k2).toColor(floor(alpha * 255 + 0.5).toInt())
}

/** True when text on a tint of [percent] strength should use the surface colour (a strong fill) rather than the ink. */
public fun surfaceInkOn(percent: Double): Boolean = percent >= 80

/** A scale colour and the strength (0-100) of the hue in it, for picking a readable text colour. */
public class ColorStop(
    public val color: ChartColor,
    public val strength: Double,
)

/** Lightest share of the colour, so the smallest value still differs from an empty cell. */
public const val SCALE_FLOOR: Double = 12.0

/** Clamped position of [value] in [min, max], 0-1. A flat or non-finite range is 1 for a finite value and 0 for a bad one. */
public fun normalize(
    value: Double,
    min: Double,
    max: Double,
): Double =
    when {
        !value.isFinite() -> 0.0
        max <= min -> 1.0
        else -> min(1.0, max(0.0, (value - min) / (max - min)))
    }

/** Strength of a sequential scale at [value]. */
public fun sequentialStrength(
    value: Double,
    min: Double,
    max: Double,
): Double = SCALE_FLOOR + normalize(value, min, max) * (100 - SCALE_FLOOR)

/** Sequential scale: [mid] (empty) to [high]. */
public fun sequentialColor(
    value: Double,
    min: Double,
    max: Double,
    high: ChartColor,
    mid: ChartColor,
): ColorStop {
    val strength = sequentialStrength(value, min, max)
    return ColorStop(tint(high, strength, mid), strength)
}

/** Signed position of [value] around [center] in -1..1, scaled by the larger side; 0 for a non-finite value. */
public fun divergingPosition(
    value: Double,
    min: Double,
    max: Double,
    center: Double = 0.0,
): Double {
    if (!value.isFinite()) return 0.0
    val reach = max(center - min, max - center).let { if (it == 0.0 || it.isNaN()) 1.0 else it }
    return ((value - center) / reach).coerceIn(-1.0, 1.0)
}

/** Diverging scale: [low] below [center], [mid] at it, [high] above. */
public fun divergingColor(
    value: Double,
    min: Double,
    max: Double,
    center: Double,
    low: ChartColor,
    mid: ChartColor,
    high: ChartColor,
): ColorStop {
    val t = divergingPosition(value, min, max, center)
    val strength = abs(t) * 100
    return ColorStop(tint(if (t < 0) low else high, strength, mid), strength)
}

/** A stepped colour range: [from] inclusive and [to] exclusive, open when infinite. */
public class ColorRange(
    public val label: String,
    public val from: Double = Double.NEGATIVE_INFINITY,
    public val to: Double = Double.POSITIVE_INFINITY,
    public val color: ChartColor? = null,
    public val tone: ChartTone? = null,
)

/** Index of the first range containing [value], or -1 (also for a non-finite value). */
public fun rangeIndex(
    value: Double,
    ranges: List<ColorRange>,
): Int {
    if (!value.isFinite()) return -1
    return ranges.indexOfFirst { value >= it.from && value < it.to }
}

/** Strength of a range with neither colour nor tone: a step of the brand scale by position. */
public fun rangeStrength(
    index: Int,
    count: Int,
): Double = SCALE_FLOOR + (index + 1).toDouble() / max(1, count) * (100 - SCALE_FLOOR)

/**
 * Fill of a stepped range: its own colour, a tone (its ink at 55% over the surface, readable with ink text in both themes), or a
 * step of the brand scale by position.
 */
public fun rangeColor(
    range: ColorRange,
    index: Int,
    count: Int,
    toneInk: (ChartTone) -> ChartColor,
    high: ChartColor,
    mid: ChartColor,
    surface: ChartColor,
): ColorStop {
    range.color?.let { return ColorStop(it, 100.0) }
    range.tone?.let { return ColorStop(tint(toneInk(it), 55.0, surface), 55.0) }
    val strength = rangeStrength(index, count)
    return ColorStop(tint(high, strength, mid), strength)
}
