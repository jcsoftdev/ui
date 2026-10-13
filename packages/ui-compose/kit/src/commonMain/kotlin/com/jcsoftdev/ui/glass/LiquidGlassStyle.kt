package com.jcsoftdev.ui.glass

import androidx.compose.animation.core.SpringSpec
import androidx.compose.animation.core.spring
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ProvidableCompositionLocal
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.theme.GlassMaterial

/** How the lens bends the backdrop across the surface. */
public enum class LiquidProfile {
    /** Only a band along the edge (see [LiquidGlassStyle.bevelWidth]) refracts; the middle is flat. The thin-bezel look. */
    Rim,

    /** The whole surface refracts, strongest at the rim and fading toward the middle, plus a faint dome. The default. */
    Full,

    /** A convex lens: the backdrop is magnified toward the middle with no directional bevel. */
    Dome,

    /**
     * A thick convex lens: the whole surface minifies the backdrop (a wide strip of the scene is squeezed into the surface) and
     * the compression grows toward the rim, strongest at the rounded ends. Both terms only push the sampled point outward, so
     * the image never folds or flips. [LiquidGlassStyle.refraction] sets how wide the strip is; the surface samples beyond its
     * own bounds, so the backdrop behind a neighbouring area is part of what it shows. Ignored by [GlassEffectContainer], whose
     * merged piece always uses the rim bend.
     */
    Convex,
}

/** How a Liquid surface reacts to touch. */
public enum class LiquidInteraction {
    /** Static. */
    None,

    /** Lifts while pressed (needs the `interactionSource` of the surface): brightening, swell, touch glow, highlight toward the finger. */
    Press,

    /**
     * [Press] plus a velocity squash and jelly settle while the surface is dragged (the pointer is observed, never consumed). The
     * squash follows drags handled by the surface or its content (a drag handler placed after `material`); movement consumed by
     * a handler outside it, such as a scroll container, hands the gesture over and ends the touch. The squash relaxes when the
     * finger rests, and the touch lasts until the last finger lifts.
     */
    Drag,
}

/** A spring in the units Compose uses. */
@Immutable
public data class LiquidSpring(
    val dampingRatio: Float,
    val stiffness: Float,
) {
    internal fun <T> spec(): SpringSpec<T> = spring(dampingRatio, stiffness)

    internal fun <T> spec(visibilityThreshold: T): SpringSpec<T> = spring(dampingRatio, stiffness, visibilityThreshold)
}

/**
 * The springs and amounts of the Liquid motion. All of it is disabled when the theme motion is off (the system animator
 * scale is 0); only the press brightening stays, without animation.
 *
 * @param press press lift (brightening, swell, glow) on and off.
 * @param follow the highlight that follows the finger.
 * @param squashX spring of the horizontal stretch while dragging and its jelly settle.
 * @param squashY spring of the vertical squash; deliberately not the same as [squashX] so the settle wobbles.
 * @param materialize how the lens grows from nothing to its refraction when the surface first appears; null skips it.
 * @param swell how much wider a pressed surface becomes.
 * @param glow opacity of the radial touch glow at the finger.
 */
@Immutable
public data class LiquidMotion(
    val press: LiquidSpring = LiquidSpring(0.74f, 600f),
    val follow: LiquidSpring = LiquidSpring(0.8f, 260f),
    val squashX: LiquidSpring = LiquidSpring(0.6f, 250f),
    val squashY: LiquidSpring = LiquidSpring(0.7f, 250f),
    val materialize: LiquidSpring? = LiquidSpring(0.8f, 180f),
    val swell: Dp = 16.dp,
    val glow: Float = 0.15f,
) {
    public companion object {
        /** Quick, well damped, a little jelly. */
        public val Standard: LiquidMotion = LiquidMotion()

        /** Softer springs: a longer, more visible wobble after a drag. */
        public val Playful: LiquidMotion get() = PlayfulMotion
    }
}

/** Tints the glass: [color] replaces the token tint color when specified, [amount] scales how strongly it covers the backdrop. */
@Immutable
public data class LiquidTint(
    val color: Color = Color.Unspecified,
    val amount: Float = 1f,
)

/**
 * The directional highlight: [intensity] scales it (0 removes it) and [angleDegrees] is where the light comes from, measured
 * clockwise from 3 o'clock (the default -125 is the top left). A pressed surface turns the highlight toward the finger.
 */
@Immutable
public data class LiquidSpecular(
    val intensity: Float = 1f,
    val angleDegrees: Float = -125f,
)

/**
 * The shadow a Liquid surface casts: [opacity] scales it, [spread] is the elevation it is built from (it grows with the size of
 * the surface) and [offsetY] pushes it down.
 */
@Immutable
public data class LiquidShadow(
    val opacity: Float = 1f,
    val spread: Dp = 14.dp,
    val offsetY: Dp = 3.dp,
)

/**
 * Every optical and motion knob of Liquid Glass in one value. Provide it app-wide with `UiTheme(liquidGlassStyle = ...)` or for a
 * subtree with `CompositionLocalProvider(LocalLiquidGlassStyle provides ...)`, or pass it to a single surface (`Modifier.material`,
 * `MaterialSurface`). The corner radius comes from the surface shape, never from the style. [Regular] (also the default) is the
 * look the kit shipped with; [Clear] and [Thick] are presets.
 *
 * The material itself ([SurfaceMaterial.Liquid] or [SurfaceMaterial.LiquidClear]) still picks the base blur, tint and dim; the
 * style tunes on top of them.
 *
 * **Contrast.** The default and the presets keep the glass tint and dim at full strength, which is what `GlassContrastTest`
 * pins (ink and ink2 at 4.5:1 or better over pure black or white), and `LiquidContrastRenderTest` measures on what the shader
 * draws: primary ink holds 4.5:1 over the text area of a resting surface of every preset down to a 56dp circle (the rim depth is
 * capped at 75% of the half short side so a deep bevel cannot thin the veil under the text); ink2 holds it on surfaces about
 * 100dp or larger, and on a small pill the veil still thins toward the rim. A pressed surface is brightened by 14% white for the
 * moment of the press, which is not part of the guarantee. Lowering [opacity] or [tint] amount, recoloring the tint, raising
 * [brightness], or taking [rim], [fresnel], [grain] or the [specular] intensity above their bounds drops it;
 * [preservesContrast] tells whether a style stays within it.
 *
 * @param refraction how far the lens bends the backdrop, as a multiple of the default (0 turns the lens off).
 * @param bevelWidth the depth of the rim: how far in the veil thins, the thickness shading runs and, for [LiquidProfile.Rim], the lens reaches.
 * @param profile the lens shape.
 * @param dispersion per-channel spread of the refraction (chromatic aberration), 0 for none.
 * @param frost blur radius of the backdrop; unspecified keeps the material token.
 * @param saturation backdrop saturation; null keeps the material token.
 * @param brightness added to the surface color after the veil, in -1..1.
 * @param tint see [LiquidTint].
 * @param rim strength of the lit/dark thickness shading at the rim (1 is the default, 0 removes it).
 * @param specular see [LiquidSpecular].
 * @param fresnel extra brightening toward the rim that does not depend on the light, 0 for none.
 * @param grain film grain amplitude, 0 for none (0.04 is visible).
 * @param opacity multiplies the strength of the tint and dim layers; below 1 the contrast guarantee is gone.
 * @param shadow see [LiquidShadow].
 * @param interaction how it reacts to touch.
 * @param motion the springs; null disables the spring motion (press still brightens).
 * @param blend how far, in dp, neighbouring shapes of a [GlassEffectContainer] pull into each other when they merge.
 */
@Immutable
public data class LiquidGlassStyle(
    val refraction: Float = 1f,
    val bevelWidth: Dp = 22.dp,
    val profile: LiquidProfile = LiquidProfile.Full,
    val dispersion: Float = 0.03f,
    val frost: Dp = Dp.Unspecified,
    val saturation: Float? = null,
    val brightness: Float = 0f,
    val tint: LiquidTint = LiquidTint(),
    val rim: Float = 1f,
    val specular: LiquidSpecular = LiquidSpecular(),
    val fresnel: Float = 0f,
    val grain: Float = 0f,
    val opacity: Float = 1f,
    val shadow: LiquidShadow = LiquidShadow(),
    val interaction: LiquidInteraction = LiquidInteraction.Press,
    val motion: LiquidMotion? = LiquidMotion.Standard,
    val blend: Dp = 24.dp,
) {
    /** True when the tint and dim keep their full strength and the surface is not brightened, so the token contrast holds. */
    val preservesContrast: Boolean
        get() =
            opacity >= 1f &&
                tint.amount >= 1f &&
                tint.color == Color.Unspecified &&
                brightness <= 0f &&
                grain <= MAX_CONTRAST_GRAIN &&
                fresnel <= MAX_CONTRAST_FRESNEL &&
                rim <= MAX_CONTRAST_RIM &&
                specular.intensity <= MAX_CONTRAST_SPECULAR

    public companion object {
        /** The default look. */
        public val Regular: LiquidGlassStyle = LiquidGlassStyle()

        /** Crisper and more transparent: a sharper bevel, more dispersion and a stronger highlight. */
        public val Clear: LiquidGlassStyle get() = ClearPreset

        /** Chunky glass: a deep bevel, strong refraction, fresnel glow, a touch of grain and a long shadow. */
        public val Thick: LiquidGlassStyle get() = ThickPreset

        /**
         * A thick, fully clear acrylic lens: no frost, no tint or dim veil, a [LiquidProfile.Convex] profile that squeezes a wide
         * strip of the backdrop into the surface and bends it hard toward the ends, strong dispersion and fresnel at the rim, a
         * thin edge highlight. Drag squash is on, so it flexes while moved.
         *
         * It has no veil (opacity 0), so it **does not keep the text contrast guarantee** ([preservesContrast] is false): put
         * only large, bold or shadowed labels on it, and never body text over a busy photo.
         */
        public val Crystal: LiquidGlassStyle get() = CrystalPreset
    }
}

internal const val MAX_CONTRAST_GRAIN: Float = 0.05f
internal const val MAX_CONTRAST_FRESNEL: Float = 0.5f
internal const val MAX_CONTRAST_RIM: Float = 1.5f
internal const val MAX_CONTRAST_SPECULAR: Float = 1.5f

/**
 * The rim never reaches deeper than this share of the half short side, whatever [LiquidGlassStyle.bevelWidth] asks for: the veil
 * thins across the rim, so a deep bevel on a small pill would otherwise thin it over the text in the middle too. The default
 * bevel is below this on every surface of 60dp or more.
 */
internal const val MAX_RIM_SHARE: Float = 0.75f

/** The rim depth in pixels for a [bevel] width on a surface whose half short side is [half]. */
internal fun rimDepthFor(
    bevel: Float,
    half: Float,
): Float = bevel.coerceAtMost(half * MAX_RIM_SHARE).coerceAtLeast(1f)

/** The style surfaces use: set it with `UiTheme(liquidGlassStyle = ...)` or provide it for a subtree. */
public val LocalLiquidGlassStyle: ProvidableCompositionLocal<LiquidGlassStyle> = staticCompositionLocalOf { LiquidGlassStyle.Regular }

private val DefaultTint = LiquidTint()

/** The material tokens with this style's frost, saturation, tint and opacity applied. Identity for the default style. */
internal fun LiquidGlassStyle.applyTo(tokens: GlassMaterial): GlassMaterial {
    if (opacity == 1f && tint == DefaultTint && frost == Dp.Unspecified && saturation == null) return tokens
    val base = if (tint.color == Color.Unspecified) tokens.tint else tint.color.copy(alpha = tokens.tint.alpha)
    return GlassMaterial(
        tint = base.copy(alpha = (base.alpha * opacity * tint.amount).coerceIn(0f, 1f)),
        border = tokens.border,
        edge = tokens.edge,
        dim = tokens.dim.copy(alpha = (tokens.dim.alpha * opacity).coerceIn(0f, 1f)),
        blur = if (frost == Dp.Unspecified) tokens.blur else frost,
        saturate = saturation ?: tokens.saturate,
    )
}

/** Shader code of the profile: 0 full, 1 rim, 2 dome, 3 convex. */
internal fun LiquidProfile.shaderCode(): Float =
    when (this) {
        LiquidProfile.Full -> 0f
        LiquidProfile.Rim -> 1f
        LiquidProfile.Dome -> 2f
        LiquidProfile.Convex -> 3f
    }

/** Magnification toward the center: Full keeps the faint dome, Rim none, Dome a strong one that grows with [refraction]. */
internal fun LiquidGlassStyle.domeAmount(): Float =
    when (profile) {
        LiquidProfile.Full -> BASE_DOME
        LiquidProfile.Rim -> 0f
        LiquidProfile.Dome -> BASE_DOME + DOME_GAIN * refraction.coerceIn(0f, 2f)
        LiquidProfile.Convex -> -CONVEX_MINIFY * refraction.coerceIn(0f, 2f)
    }

internal const val BASE_DOME: Float = 0.05f
internal const val DOME_GAIN: Float = 0.16f

/** How much wider a strip [LiquidProfile.Convex] samples per unit of refraction (the dome amount is minus this). */
internal const val CONVEX_MINIFY: Float = 0.22f

/** Share of the usual rim bend a [LiquidProfile.Convex] lens applies (outward). */
internal const val CONVEX_BEND: Float = 0.5f

/**
 * How far beyond the surface edge a [LiquidProfile.Convex] lens samples, in px: the minify of the farthest corner plus the
 * outward rim bend of [strength] px. The backdrop layer is padded by this much.
 */
internal fun LiquidGlassStyle.convexReach(
    halfWidth: Float,
    halfHeight: Float,
    strength: Float,
): Float =
    if (profile != LiquidProfile.Convex) {
        0f
    } else {
        kotlin.math.hypot(halfWidth, halfHeight) * CONVEX_MINIFY * refraction.coerceIn(0f, 2f) + strength.coerceAtLeast(0f)
    }

/** Surface size to the factor thickness shading and the shadow are scaled by: bigger is thicker, within sane bounds. */
internal fun sizeScale(
    shortSide: Float,
    reference: Float,
): Float = (shortSide / reference).coerceIn(0.6f, 1.5f)
