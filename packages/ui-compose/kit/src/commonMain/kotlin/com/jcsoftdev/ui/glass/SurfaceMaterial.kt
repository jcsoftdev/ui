package com.jcsoftdev.ui.glass

import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.staticCompositionLocalOf
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

    /** Regular Liquid Glass. */
    Glass,

    /** Clear Liquid Glass for media-rich backdrops. */
    GlassClear,
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
}

@Immutable
internal class ResolvedMaterial(
    val mode: SurfaceMode,
    val variant: SurfaceMaterial,
    /** Glass was requested but accessibility settings force an opaque surface (with a border). */
    val forcedOpaque: Boolean,
    val highContrast: Boolean,
) {
    val isGlass: Boolean get() = mode == SurfaceMode.Tint || mode == SurfaceMode.Blur

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
): ResolvedMaterial {
    val variant = requested ?: if (role == SurfaceRole.Chrome && style == UiStyle.Glass) SurfaceMaterial.Glass else SurfaceMaterial.Solid
    val mode =
        when {
            variant == SurfaceMaterial.Solid -> SurfaceMode.Solid
            reduceTransparency || highContrast -> SurfaceMode.Solid
            nested -> SurfaceMode.Nested
            blurAvailable -> SurfaceMode.Blur
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

/** The shared backdrop surfaces sample: set by [com.jcsoftdev.ui.overlays.OverlayHost] for overlays; null in content. */
public val LocalGlassState: androidx.compose.runtime.ProvidableCompositionLocal<GlassState?> = compositionLocalOf { null }

internal fun glassTokens(
    variant: SurfaceMaterial,
    dark: Boolean,
): GlassMaterial =
    when (variant) {
        SurfaceMaterial.GlassClear -> if (dark) UiGlass.ClearDark else UiGlass.ClearLight
        else -> if (dark) UiGlass.RegularDark else UiGlass.RegularLight
    }

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
        blurAvailable = glass != null && backdropBlurSupported(),
    )
