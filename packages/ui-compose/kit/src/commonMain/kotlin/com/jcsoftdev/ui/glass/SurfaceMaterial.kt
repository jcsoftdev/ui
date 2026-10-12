package com.jcsoftdev.ui.glass

import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.theme.GlassMaterial
import com.jcsoftdev.ui.theme.UiGlass
import com.jcsoftdev.ui.theme.UiStyle
import com.jcsoftdev.ui.theme.UiTheme

/**
 * What a surface is made of, the Compose counterpart of the web `solid`, `glass` and `glass-clear` materials.
 * [Glass] is the adaptive, legible variant; [GlassClear] is more transparent and carries a stronger dim layer.
 * Glass blurs what is behind it where the platform allows and is otherwise a translucent tint; it is always opaque when
 * the theme asks for reduced transparency or high contrast, and nested glass falls back to a near-solid fill.
 */
public enum class SurfaceMaterial {
    /** Opaque fill. */
    Solid,

    /** Frosted glass: a blurred, saturated backdrop under a tint. Regular, adaptive and legible. */
    Glass,

    /** Frosted glass, clear variant: more transparent, with a stronger dim layer. */
    GlassClear,

    /**
     * Liquid Glass: the Apple look. Low center blur, a lens that refracts the backdrop at the edges (with a little chromatic
     * dispersion), a lit rim, inner thickness shading and an outer shadow. Where the platform cannot run the lens shader it is
     * blur plus rim and shadow, and below that the tint plus rim.
     */
    Liquid,

    /** Liquid Glass, clear variant: more transparent, with a stronger dim layer. */
    LiquidClear,
}

/**
 * Which glass a chrome surface gets with `UiStyle.Glass` when it names no material: [Frosted] (the blurred
 * [SurfaceMaterial.Glass]) or [Liquid] (the lensed [SurfaceMaterial.Liquid]). Explicit materials are never changed by it.
 */
public enum class GlassVariant {
    /** Blur, tint, dim, edge highlight. */
    Frosted,

    /** Lens refraction, rim, thickness and shadow. */
    Liquid,
}

/** Which layer of the interface a surface belongs to; decides what a null material means. */
internal enum class SurfaceRole {
    /** Controls and navigation floating above content: glass with [UiStyle.Glass]. */
    Chrome,

    /** Content such as cards and lists: always solid unless asked. */
    Content,
}

internal enum class SurfaceMode {
    /** The component's own opaque colors. */
    Solid,

    /** Glass inside glass: near-solid float fill. */
    Nested,

    /** Translucent tint without a backdrop. */
    Tint,

    /** Tint over a blurred, saturated copy of the backdrop. */
    Blur,

    /** [Blur] whose edges are refracted by the lens shader (Liquid Glass). */
    Lens,
}

@Immutable
internal class ResolvedMaterial(
    val mode: SurfaceMode,
    val variant: SurfaceMaterial,
    /** Glass was requested but accessibility settings force an opaque surface (with a border). */
    val forcedOpaque: Boolean,
    val highContrast: Boolean,
) {
    val isGlass: Boolean get() = mode == SurfaceMode.Tint || mode == SurfaceMode.Blur || mode == SurfaceMode.Lens

    /** Draws the Liquid look (rim, thickness shading, shadow), with or without the lens. */
    val liquid: Boolean get() = variant == SurfaceMaterial.Liquid || variant == SurfaceMaterial.LiquidClear

    val clear: Boolean get() = variant == SurfaceMaterial.GlassClear || variant == SurfaceMaterial.LiquidClear

    /** Glass children of a glass (or already nested) surface fall back to the near-solid fill. */
    val providesNesting: Boolean get() = isGlass || mode == SurfaceMode.Nested
}

/**
 * Pure decision of how a surface renders. Order: a solid request stays solid; reduced transparency or high contrast
 * force opaque; glass inside glass becomes [SurfaceMode.Nested]; otherwise [SurfaceMode.Blur] when a backdrop can be
 * sampled and the platform blurs, else [SurfaceMode.Tint].
 */
internal fun resolveMaterial(
    requested: SurfaceMaterial?,
    role: SurfaceRole,
    style: UiStyle,
    reduceTransparency: Boolean,
    highContrast: Boolean,
    nested: Boolean,
    blurAvailable: Boolean,
    glassVariant: GlassVariant = GlassVariant.Frosted,
    lensAvailable: Boolean = false,
): ResolvedMaterial {
    val chromeGlass = if (glassVariant == GlassVariant.Liquid) SurfaceMaterial.Liquid else SurfaceMaterial.Glass
    val variant = requested ?: if (role == SurfaceRole.Chrome && style == UiStyle.Glass) chromeGlass else SurfaceMaterial.Solid
    val liquid = variant == SurfaceMaterial.Liquid || variant == SurfaceMaterial.LiquidClear
    val mode =
        when {
            variant == SurfaceMaterial.Solid -> SurfaceMode.Solid
            reduceTransparency || highContrast -> SurfaceMode.Solid
            nested -> SurfaceMode.Nested
            blurAvailable -> if (liquid && lensAvailable) SurfaceMode.Lens else SurfaceMode.Blur
            else -> SurfaceMode.Tint
        }
    val forced = variant != SurfaceMaterial.Solid && mode == SurfaceMode.Solid
    return ResolvedMaterial(mode, variant, forcedOpaque = forced, highContrast = forced && highContrast)
}

internal val LocalGlassNested = staticCompositionLocalOf { false }

/** Whether the theme is dark; picks the glass token set. */
internal val LocalUiDark = staticCompositionLocalOf { false }
internal val LocalUiStyle = staticCompositionLocalOf { UiStyle.Default }
internal val LocalReduceTransparency = staticCompositionLocalOf { false }
internal val LocalHighContrast = staticCompositionLocalOf { false }
internal val LocalBackdropBlur = staticCompositionLocalOf { true }
internal val LocalGlassVariant = staticCompositionLocalOf { GlassVariant.Frosted }

/** Tests turn the lens off to compare against the plain Liquid look; the platform check still applies. */
internal val LocalLensSupport = staticCompositionLocalOf { true }

/** The shared backdrop surfaces sample: set by [com.jcsoftdev.ui.overlays.OverlayHost] for overlays; null in content. */
public val LocalGlassState: androidx.compose.runtime.ProvidableCompositionLocal<GlassState?> = compositionLocalOf { null }

internal fun glassTokens(
    variant: SurfaceMaterial,
    dark: Boolean,
): GlassMaterial =
    when (variant) {
        SurfaceMaterial.GlassClear -> if (dark) UiGlass.ClearDark else UiGlass.ClearLight
        SurfaceMaterial.Liquid -> if (dark) LiquidRegularDark else LiquidRegularLight
        SurfaceMaterial.LiquidClear -> if (dark) LiquidClearDark else LiquidClearLight
        else -> if (dark) UiGlass.RegularDark else UiGlass.RegularLight
    }

// Liquid keeps the shared tokens but lets more of the backdrop (and the lens) through: a lower center blur and a slightly lighter
// tint. The dim layer is kept as is, and the tint scales are the lowest that keep ink and ink2 at 4.5:1 or better over a pure
// black or white backdrop (see GlassContrastTest).
private fun liquid(
    base: GlassMaterial,
    blur: Dp,
    tintScale: Float,
): GlassMaterial = GlassMaterial(base.tint.scaleAlpha(tintScale), base.border, base.edge, base.dim, blur, base.saturate)

private fun Color.scaleAlpha(f: Float) = copy(alpha = alpha * f)

private val LiquidRegularLight = liquid(UiGlass.RegularLight, 8.dp, 0.95f)
private val LiquidRegularDark = liquid(UiGlass.RegularDark, 8.dp, 0.95f)
private val LiquidClearLight = liquid(UiGlass.ClearLight, 4.dp, 0.8f)
private val LiquidClearDark = liquid(UiGlass.ClearDark, 4.dp, 0.8f)

/** Resolves [requested] for a [role] against the theme, accessibility flags, nesting and the backdrop in scope. */
@Composable
internal fun rememberResolvedMaterial(
    requested: SurfaceMaterial?,
    role: SurfaceRole,
    glass: GlassState? = LocalGlassState.current,
): ResolvedMaterial =
    resolveMaterial(
        requested = requested,
        role = role,
        style = UiTheme.style,
        reduceTransparency = UiTheme.reduceTransparency,
        highContrast = UiTheme.highContrast,
        nested = LocalGlassNested.current,
        blurAvailable = glass != null && LocalBackdropBlur.current && backdropBlurSupported(),
        glassVariant = LocalGlassVariant.current,
        lensAvailable = lensSupported() && LocalLensSupport.current,
    )
