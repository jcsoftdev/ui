package com.jcsoftdev.ui.glass

import androidx.compose.runtime.Immutable
import kotlin.math.hypot

/**
 * A thick convex lens, the lens of [LiquidGlass.Crystal]: the whole surface minifies the backdrop (a wide strip of the scene is
 * squeezed into the surface) and the compression grows toward the rim, strongest at the rounded ends. Both terms only push the
 * sampled point outward, so the image never folds or flips. [refraction] sets how wide the strip is; the surface samples beyond
 * its own bounds, so the backdrop behind a neighbouring area is part of what it shows. A [GlassEffectContainer] ignores the
 * profile: its merged piece always uses the rim bend.
 */
@Immutable
public data class CrystalLens(
    override val refraction: Float = 1.67f,
) : LiquidLens() {
    override val profileCode: Float get() = 3f

    override val bend: Float get() = CONVEX_BEND

    override fun dome(): Float = -CONVEX_MINIFY * refraction.coerceIn(0f, 2f)

    // The minify of the farthest corner plus the outward rim bend of [strength] px.
    override fun reach(
        halfWidth: Float,
        halfHeight: Float,
        strength: Float,
    ): Float = hypot(halfWidth, halfHeight) * CONVEX_MINIFY * refraction.coerceIn(0f, 2f) + strength.coerceAtLeast(0f)

    override fun renderer(): LensRenderer = LensRenderer()
}

/** How much wider a strip [CrystalLens] samples per unit of refraction (its dome amount is minus this). */
internal const val CONVEX_MINIFY: Float = 0.22f

/** Share of the usual rim bend a [CrystalLens] applies (outward). */
internal const val CONVEX_BEND: Float = 0.5f
