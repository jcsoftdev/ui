package com.jcsoftdev.ui.glass

import androidx.compose.runtime.Immutable

/**
 * Chromatic dispersion of a Liquid lens: the refraction is spread per channel, red bent further than green and blue less, so
 * the rim shows a thin rainbow. [amount] is the spread (0.03 is the kit's default, 0 none). It is a parameter of
 * the lens ([RefractionLens.dispersion], [CrystalLens.dispersion]), so it cannot exist without one.
 *
 * Its shader code is only in an app that passes a `Dispersion`: a lens without it takes one sample per pixel instead of three.
 */
@Immutable
public data class Dispersion(
    val amount: Float = 0.03f,
) {
    internal val lensProgram: LensProgram get() = DispersiveLens.value

    internal val mergeProgram: MergeProgram get() = DispersiveMerge.value
}

// Red and blue are sampled apart; at 0 the three channels share one sample, so the output equals the plain program's.
private const val DISPERSION_SKSL: String = """
    // Dispersion samples red and blue apart; without it the three channels share one sample (two fetches per pixel saved).
    if (dispersion != 0.0) {
        c.r = float(content.eval(clamp(coord + off * (1.0 + dispersion), lo, hi)).r);
        c.b = float(content.eval(clamp(coord + off * (1.0 - dispersion), lo, hi)).b);
    }
"""

private object DispersiveLens {
    val value: LensProgram = LensProgram(DISPERSION_SKSL, LENS_MAIN)
}

private object DispersiveMerge {
    val value: MergeProgram = MergeProgram(LensProgram(DISPERSION_SKSL, MERGE_MAIN))
}
