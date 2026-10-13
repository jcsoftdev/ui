package com.jcsoftdev.ui.glass

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.InteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.isSpecified
import androidx.compose.ui.graphics.isUnspecified
import com.jcsoftdev.ui.theme.UiTheme

/**
 * Fills this node with [material] clipped to [shape]: solid ([solid]), frosted glass (tint, dim, edge highlight, border and a
 * blurred copy of [glass]) or [LiquidGlass] (with the lens, dispersion and interaction it was given). Everything the theme and
 * the context decide still applies: with `UiTheme(reduceTransparency = true)` or `highContrast = true` the glass becomes opaque
 * with a border, and glass inside another glass surface (see [MaterialSurface]) becomes a near-solid fill.
 *
 * It does not provide the nesting marker for children; use [MaterialSurface] when the surface has content that can be glass.
 *
 * @param glass the backdrop to blur; defaults to the one the overlay host provides. Null draws the tint without blur.
 * @param solid fill used when the material resolves to opaque.
 * @param interactionSource for a [LiquidGlass] with an [LiquidGlass.interaction], a press on it brightens the surface and
 * strengthens its lens; with motion enabled the surface also swells, glows at the finger and turns its highlight toward it.
 * Reduced motion keeps only the brightening.
 */
@Composable
public fun Modifier.material(
    material: SurfaceMaterial,
    shape: Shape,
    solid: Color = UiTheme.colors.float,
    glass: GlassState? = LocalGlassState.current,
    interactionSource: InteractionSource? = null,
): Modifier {
    val resolved = rememberResolvedMaterial(material, SurfaceRole.Content, glass)
    return surfaceMaterial(resolved, shape, solid, UiTheme.colors.hair, glass, interactionSource = interactionSource, interactive = true)
}

/**
 * A [Box] filled with [material] that also marks its children as inside glass, so glass nested in it falls back to a
 * near-solid fill (Apple: no glass on glass). See [material] for [interactionSource].
 */
@Composable
public fun MaterialSurface(
    material: SurfaceMaterial,
    shape: Shape,
    modifier: Modifier = Modifier,
    solid: Color = UiTheme.colors.float,
    glass: GlassState? = LocalGlassState.current,
    interactionSource: InteractionSource? = null,
    content: @Composable BoxScope.() -> Unit,
) {
    val resolved = rememberResolvedMaterial(material, SurfaceRole.Content, glass)
    Box(
        modifier.surfaceMaterial(
            resolved,
            shape,
            solid,
            UiTheme.colors.hair,
            glass,
            interactionSource = interactionSource,
            interactive = true,
        ),
    ) {
        GlassNesting(resolved) { content() }
    }
}

/** Provides the "inside glass" marker to [content] when [resolved] is a glass or nested surface. */
@Composable
internal fun GlassNesting(
    resolved: ResolvedMaterial,
    content: @Composable () -> Unit,
) {
    when {
        resolved.providesNesting -> CompositionLocalProvider(LocalGlassNested provides true, content = content)
        // An opaque surface hides the page behind it, so glass inside it must not sample that page.
        resolved.mode == SurfaceMode.Solid -> CompositionLocalProvider(LocalGlassState provides null, content = content)
        else -> content()
    }
}

/**
 * The single place a component's surface is drawn. [container] and [outline] are the component's own opaque colors, used
 * when the surface is solid (the forced-opaque case swaps the border for a stronger one under high contrast). A glass surface
 * is drawn by its material, so a component never references the code of a material the app does not use.
 * [observe] is read in the draw phase so the backdrop offset follows a state-driven translation of an ancestor.
 * [interactionSource] and [interactive] reach only a [LiquidGlass] with an interaction (see [material]).
 */
@Composable
internal fun Modifier.surfaceMaterial(
    resolved: ResolvedMaterial,
    shape: Shape,
    container: Color,
    outline: Color,
    glass: GlassState?,
    observe: (() -> Float)? = null,
    interactionSource: InteractionSource? = null,
    interactive: Boolean = false,
): Modifier {
    val colors = UiTheme.colors
    val borderWidth = UiTheme.sizes.borderWidth
    return when (resolved.mode) {
        SurfaceMode.Solid -> {
            val line =
                when {
                    resolved.highContrast -> colors.lineStrong
                    outline.isUnspecified && resolved.forcedOpaque -> colors.hair
                    else -> outline
                }
            val base = clip(shape).background(container)
            if (line.isSpecified) base.border(borderWidth, line, shape) else base
        }
        SurfaceMode.Nested -> clip(shape).background(colors.float).border(borderWidth, colors.hair, shape)
        SurfaceMode.Tint, SurfaceMode.Blur, SurfaceMode.Lens ->
            resolved.variant.glassSurface(this, resolved, shape, glass, observe, interactionSource, interactive)
    }
}
