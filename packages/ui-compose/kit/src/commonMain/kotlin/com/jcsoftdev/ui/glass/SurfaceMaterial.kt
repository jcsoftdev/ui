package com.jcsoftdev.ui.glass

import androidx.compose.foundation.interaction.InteractionSource
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Shape
import com.jcsoftdev.ui.theme.GlassMaterial
import com.jcsoftdev.ui.theme.UiGlass
import com.jcsoftdev.ui.theme.UiStyle
import com.jcsoftdev.ui.theme.UiTheme

/**
 * What a surface is made of, the Compose counterpart of the web `solid`, `glass` and `glass-clear` materials and of the liquid
 * material object. [Solid] is opaque, [Glass] the adaptive, legible frosted glass and [GlassClear] its more transparent variant;
 * [LiquidGlass] is the Apple look, built from the features passed to it.
 *
 * Each material carries the code that draws it, so an app ships only the materials it names: without [LiquidGlass] (or one of
 * its presets) none of the Liquid Glass code is in the APK, and a [LiquidGlass] without a lens ships none of the lens. Glass is
 * always opaque when the theme asks for reduced transparency or high contrast, and nested glass falls back to a near-solid fill.
 */
@Immutable
public sealed class SurfaceMaterial {
    /** False only for [Solid]. */
    internal open val isGlass: Boolean get() = true

    /** True for a material that refracts its backdrop where the platform can run the lens shader. */
    internal open val refracts: Boolean get() = false

    /** The tint, dim, blur and edge tokens of this material in the light or dark theme. */
    internal abstract fun tokens(dark: Boolean): GlassMaterial

    /**
     * The glass surface of a resolved [SurfaceMode.Tint], [SurfaceMode.Blur] or [SurfaceMode.Lens]. [interactive] is true for
     * [material] and [MaterialSurface], the only callers whose [interactionSource] can move the surface.
     */
    @Composable
    internal abstract fun glassSurface(
        modifier: Modifier,
        resolved: ResolvedMaterial,
        shape: Shape,
        glass: GlassState?,
        observe: (() -> Float)?,
        interactionSource: InteractionSource?,
        interactive: Boolean,
    ): Modifier

    public companion object {
        /** Opaque fill. */
        public val Solid: SurfaceMaterial get() = SolidMaterial

        /** Frosted glass: a blurred, saturated backdrop under a tint. Regular, adaptive and legible. */
        public val Glass: SurfaceMaterial get() = FrostedRegular

        /** Frosted glass, clear variant: more transparent, with a stronger dim layer. */
        public val GlassClear: SurfaceMaterial get() = FrostedClear
    }
}

internal object SolidMaterial : SurfaceMaterial() {
    override val isGlass: Boolean get() = false

    override fun tokens(dark: Boolean): GlassMaterial = if (dark) UiGlass.RegularDark else UiGlass.RegularLight

    // Never called: a solid material resolves to SurfaceMode.Solid, which surfaceMaterial draws itself.
    @Composable
    override fun glassSurface(
        modifier: Modifier,
        resolved: ResolvedMaterial,
        shape: Shape,
        glass: GlassState?,
        observe: (() -> Float)?,
        interactionSource: InteractionSource?,
        interactive: Boolean,
    ): Modifier = modifier

    override fun toString(): String = "Solid"
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

    /** [Blur] whose edges are refracted by the lens shader (Liquid Glass with a lens). */
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

    /** Glass children of a glass (or already nested) surface fall back to the near-solid fill. */
    val providesNesting: Boolean get() = isGlass || mode == SurfaceMode.Nested
}

/**
 * Pure decision of how a surface renders. Order: a solid request stays solid; reduced transparency or high contrast force
 * opaque; glass inside glass becomes [SurfaceMode.Nested]; otherwise, when a backdrop can be sampled and the platform blurs,
 * [SurfaceMode.Lens] for a material with a lens where the lens shader runs and [SurfaceMode.Blur] for the rest, else
 * [SurfaceMode.Tint]. A null request is [chromeGlass] for a chrome surface under [UiStyle.Glass], and solid otherwise.
 */
internal fun resolveMaterial(
    requested: SurfaceMaterial?,
    role: SurfaceRole,
    style: UiStyle,
    reduceTransparency: Boolean,
    highContrast: Boolean,
    nested: Boolean,
    blurAvailable: Boolean,
    chromeGlass: SurfaceMaterial = SurfaceMaterial.Glass,
    lensAvailable: Boolean = false,
): ResolvedMaterial {
    val variant = requested ?: if (role == SurfaceRole.Chrome && style == UiStyle.Glass) chromeGlass else SurfaceMaterial.Solid
    val mode =
        when {
            !variant.isGlass -> SurfaceMode.Solid
            reduceTransparency || highContrast -> SurfaceMode.Solid
            nested -> SurfaceMode.Nested
            blurAvailable -> if (variant.refracts && lensAvailable) SurfaceMode.Lens else SurfaceMode.Blur
            else -> SurfaceMode.Tint
        }
    val forced = variant.isGlass && mode == SurfaceMode.Solid
    return ResolvedMaterial(mode, variant, forcedOpaque = forced, highContrast = forced && highContrast)
}

internal val LocalGlassNested = staticCompositionLocalOf { false }

/** Whether the theme is dark; picks the glass token set. */
internal val LocalUiDark = staticCompositionLocalOf { false }
internal val LocalUiStyle = staticCompositionLocalOf { UiStyle.Default }
internal val LocalReduceTransparency = staticCompositionLocalOf { false }
internal val LocalHighContrast = staticCompositionLocalOf { false }
internal val LocalBackdropBlur = staticCompositionLocalOf { true }

/** What chrome surfaces are made of under [UiStyle.Glass] when they name no material: `UiTheme(chromeGlass = ...)`. */
internal val LocalChromeGlass = staticCompositionLocalOf { SurfaceMaterial.Glass }

/** Tests turn the lens off to compare against the plain Liquid look; the platform check still applies. */
internal val LocalLensSupport = staticCompositionLocalOf { true }

/** The shared backdrop surfaces sample: set by [com.jcsoftdev.ui.overlays.OverlayHost] for overlays; null in content. */
public val LocalGlassState: androidx.compose.runtime.ProvidableCompositionLocal<GlassState?> = compositionLocalOf { null }

/** The tokens [material] draws with in the light or dark theme. */
internal fun glassTokens(
    material: SurfaceMaterial,
    dark: Boolean,
): GlassMaterial = material.tokens(dark)

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
        chromeGlass = LocalChromeGlass.current,
        lensAvailable = lensSupported() && LocalLensSupport.current,
    )
