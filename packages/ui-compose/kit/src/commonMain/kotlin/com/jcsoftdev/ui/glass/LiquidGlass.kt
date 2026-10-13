package com.jcsoftdev.ui.glass

import androidx.compose.foundation.interaction.InteractionSource
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.theme.GlassMaterial
import com.jcsoftdev.ui.theme.UiGlass

/** Tints the glass: [color] replaces the token tint color when specified, [amount] scales how strongly it covers the backdrop. */
@Immutable
public data class LiquidTint(
    val color: Color = Color.Unspecified,
    val amount: Float = 1f,
)

/**
 * The directional highlight: [intensity] scales it (0 removes it) and [angleDegrees] is where the light comes from, measured
 * clockwise from 3 o'clock (the default -125 is the top left). A pressed surface turns the highlight toward the finger. It is
 * the lit rim of every Liquid surface (with a lens, the glint the lens shader draws at the wall), so it is a value, not a
 * feature: it ships with the base material.
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
 * Liquid Glass, the Apple look, built from opt-in features. Pass it as the `material` of a surface, or app-wide as
 * `UiTheme(chromeGlass = ...)` for the chrome under `UiStyle.Glass`.
 *
 * `LiquidGlass()` alone is the base material: a low blur under a lighter tint, a lit and shaded rim and an outer shadow. Each
 * feature is a value you pass, and only the features an app passes are in its APK:
 * - [lens]: [RefractionLens] bends the backdrop at the edges (Android 13+, Skia targets); [CrystalLens] is the thick convex
 *   lens of [Crystal]. Without a lens, or where the platform cannot run the shader, the surface is the base material.
 * - [dispersion]: [Dispersion] splits the refraction per channel (chromatic aberration). Needs a [lens].
 * - [interaction]: [LiquidInteraction.Press] lifts the surface while pressed and materializes the lens when it appears;
 *   [LiquidInteraction.Drag] adds the velocity squash. Without one the surface is static.
 *
 * Each preset ([Regular], [Clear], [Thick], [Crystal]) is its own value, so an app ships only the presets it reads. The corner
 * radius comes from the surface shape, never from the material.
 *
 * **Contrast.** The base tokens and the presets keep the glass tint and dim at full strength, which is what `GlassContrastTest`
 * pins (ink and ink2 at 4.5:1 or better over pure black or white), and `LiquidContrastRenderTest` measures on what the shader
 * draws: primary ink holds 4.5:1 over the text area of a resting surface of every preset but [Crystal] down to a 56dp circle (the
 * rim depth is capped at 75% of the half short side so a deep bevel cannot thin the veil under the text); ink2 holds it on
 * surfaces about 100dp or larger, and on a small pill the veil still thins toward the rim. A pressed surface is brightened by 14%
 * white for the moment of the press, which is not part of the guarantee. Lowering [opacity] or [tint] amount, recoloring the
 * tint, raising [brightness], or taking [rim], [fresnel], [grain] or the [specular] intensity above their bounds drops it;
 * [preservesContrast] tells whether a material stays within it.
 *
 * @param clear the clear token set: more transparent, with a stronger dim layer (the web `liquid-clear`).
 * @param lens the refraction; null keeps the base material.
 * @param dispersion per-channel spread of the refraction; null for none.
 * @param interaction how it reacts to touch, and its springs; null keeps it static.
 * @param bevelWidth the depth of the rim: how far in the veil thins, the thickness shading runs and, for [LiquidProfile.Rim], the lens reaches.
 * @param frost blur radius of the backdrop; unspecified keeps the token.
 * @param saturation backdrop saturation; null keeps the token.
 * @param brightness added to the surface color after the veil, in -1..1 (lens only).
 * @param tint see [LiquidTint].
 * @param rim strength of the lit/dark thickness shading at the rim (1 is the default, 0 removes it).
 * @param specular see [LiquidSpecular].
 * @param fresnel extra brightening toward the rim that does not depend on the light, 0 for none (lens only).
 * @param grain film grain amplitude, 0 for none (0.04 is visible; lens only).
 * @param opacity multiplies the strength of the tint and dim layers; below 1 the contrast guarantee is gone.
 * @param shadow see [LiquidShadow].
 * @param blend how far, in dp, neighbouring shapes of a [GlassEffectContainer] pull into each other when they merge.
 */
@Immutable
public data class LiquidGlass(
    val clear: Boolean = false,
    val lens: LiquidLens? = null,
    val dispersion: Dispersion? = null,
    val interaction: LiquidInteraction? = null,
    val bevelWidth: Dp = 22.dp,
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
    val blend: Dp = 24.dp,
) : SurfaceMaterial() {
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

    override val refracts: Boolean get() = lens != null

    /** The Liquid tokens of the theme, before this material's tint, frost, saturation and opacity. */
    internal fun baseTokens(dark: Boolean): GlassMaterial =
        if (clear) {
            if (dark) LiquidClearDark else LiquidClearLight
        } else {
            if (dark) LiquidRegularDark else LiquidRegularLight
        }

    override fun tokens(dark: Boolean): GlassMaterial = applyTo(baseTokens(dark))

    @Composable
    override fun glassSurface(
        modifier: Modifier,
        resolved: ResolvedMaterial,
        shape: Shape,
        glass: GlassState?,
        observe: (() -> Float)?,
        interactionSource: InteractionSource?,
        interactive: Boolean,
    ): Modifier = liquidSurface(modifier, this, resolved, shape, glass, observe, interactionSource, interactive)

    public companion object {
        /**
         * The kit's Liquid Glass: a full-surface [RefractionLens], a little [Dispersion] and the [LiquidInteraction.Press] lift.
         * The look `SurfaceMaterial.Liquid` had.
         */
        public val Regular: LiquidGlass get() = RegularPreset.value

        /** Crisper and more transparent: a sharper bevel, more dispersion and a stronger highlight. */
        public val Clear: LiquidGlass get() = ClearPreset.value

        /** Chunky glass: a deep bevel, strong refraction, fresnel glow, a touch of grain, a long shadow and playful springs. */
        public val Thick: LiquidGlass get() = ThickPreset.value

        /**
         * A thick, fully clear acrylic lens: no frost, no tint or dim veil, a [CrystalLens] that squeezes a wide strip of the
         * backdrop into the surface and bends it hard toward the ends, strong dispersion and fresnel at the rim, a thin edge
         * highlight. [LiquidInteraction.Drag] is on, so it flexes while moved.
         *
         * It has no veil (opacity 0), so it **does not keep the text contrast guarantee** ([preservesContrast] is false): put only
         * large, bold or shadowed labels on it, and never body text over a busy photo.
         */
        public val Crystal: LiquidGlass get() = CrystalPreset.value
    }
}

internal const val MAX_CONTRAST_GRAIN: Float = 0.05f
internal const val MAX_CONTRAST_FRESNEL: Float = 0.5f
internal const val MAX_CONTRAST_RIM: Float = 1.5f
internal const val MAX_CONTRAST_SPECULAR: Float = 1.5f

/**
 * The rim never reaches deeper than this share of the half short side, whatever [LiquidGlass.bevelWidth] asks for: the veil
 * thins across the rim, so a deep bevel on a small pill would otherwise thin it over the text in the middle too. The default
 * bevel is below this on every surface of 60dp or more.
 */
internal const val MAX_RIM_SHARE: Float = 0.75f

/** The rim depth in pixels for a [bevel] width on a surface whose half short side is [half]. */
internal fun rimDepthFor(
    bevel: Float,
    half: Float,
): Float = bevel.coerceAtMost(half * MAX_RIM_SHARE).coerceAtLeast(1f)

// Liquid keeps the shared tokens but lets more of the backdrop (and the lens) through: a lower center blur and a slightly lighter
// tint. The dim layer is kept as is, and the tint scales are the lowest that keep ink and ink2 at 4.5:1 or better over a pure
// black or white backdrop (see GlassContrastTest).
private fun liquid(
    base: GlassMaterial,
    blur: Dp,
    tintScale: Float,
): GlassMaterial = GlassMaterial(base.tint.scaleAlpha(tintScale), base.border, base.edge, base.dim, blur, base.saturate)

private fun Color.scaleAlpha(f: Float) = copy(alpha = alpha * f)

private val LiquidRegularLight = liquid(UiGlass.RegularLight, 4.dp, 0.95f)
private val LiquidRegularDark = liquid(UiGlass.RegularDark, 4.dp, 0.95f)
private val LiquidClearLight = liquid(UiGlass.ClearLight, 2.dp, 0.8f)
private val LiquidClearDark = liquid(UiGlass.ClearDark, 2.dp, 0.8f)

private val DefaultTint = LiquidTint()

/** The tokens with this material's frost, saturation, tint and opacity applied. Identity for the defaults. */
internal fun LiquidGlass.applyTo(tokens: GlassMaterial): GlassMaterial {
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

/** Surface size to the factor thickness shading and the shadow are scaled by: bigger is thicker, within sane bounds. */
internal fun sizeScale(
    shortSide: Float,
    reference: Float,
): Float = (shortSide / reference).coerceIn(0.6f, 1.5f)
