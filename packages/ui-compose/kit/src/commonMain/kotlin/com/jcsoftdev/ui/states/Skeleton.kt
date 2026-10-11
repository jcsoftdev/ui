package com.jcsoftdev.ui.states

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.atoms.rememberLoopPhase
import com.jcsoftdev.ui.theme.UiTheme

/** Colors of a skeleton: the resting block and the highlight that sweeps over it. */
@Immutable
public class SkeletonColors(
    public val base: Color,
    public val highlight: Color,
) {
    /** Copy with selected colors replaced. */
    public fun copy(
        base: Color = this.base,
        highlight: Color = this.highlight,
    ): SkeletonColors = SkeletonColors(base, highlight)
}

/** Default colors, shapes and metrics of the skeletons. */
public object SkeletonDefaults {
    /** Colors in the active theme. */
    @Composable
    @ReadOnlyComposable
    public fun colors(): SkeletonColors {
        val c = UiTheme.colors
        return SkeletonColors(c.surface2, c.surface)
    }

    /** Shape of a rectangle block; the theme `xs` shape. */
    public val shape: Shape
        @Composable @ReadOnlyComposable
        get() = UiTheme.shapes.xs

    /** Height of a rectangle block and of one text line. */
    public val height: Dp = 12.dp

    /** Gap between text lines; the theme `space8`. */
    public val lineSpacing: Dp
        @Composable @ReadOnlyComposable
        get() = UiTheme.sizes.space8

    /** Width of the last text line, as a fraction of the full width. */
    public const val LAST_LINE_FRACTION: Float = 0.6f

    /** Diameter of a circle block. */
    public val circleSize: Dp = 40.dp

    /** Duration of one shimmer sweep in milliseconds. */
    public const val SWEEP_MILLIS: Int = 1400
}

private const val BAND = 0.6f

/** Block that shimmers while motion is on. Without motion (animations removed in the system settings) it is static, with no highlight drawn. */
@Composable
private fun Modifier.shimmer(colors: SkeletonColors): Modifier {
    val phase = rememberLoopPhase(SkeletonDefaults.SWEEP_MILLIS)
    return background(colors.base).drawWithContent {
        val p = phase.value
        if (p > 0f) {
            val band = size.width * BAND
            val x = p * (size.width + band) - band
            drawRect(Brush.horizontalGradient(listOf(Color.Transparent, colors.highlight, Color.Transparent), x, x + band))
        }
    }
}

/**
 * Rectangular placeholder block; size it with [modifier] (it fills the width and is [SkeletonDefaults.height] tall unless [modifier] sets a size).
 * The block is decorative: wrap the loading area in a [SkeletonGroup] to announce it once.
 */
@Composable
public fun Skeleton(
    modifier: Modifier = Modifier,
    shape: Shape = SkeletonDefaults.shape,
    colors: SkeletonColors = SkeletonDefaults.colors(),
) {
    Box(
        modifier
            .fillMaxWidth()
            .height(SkeletonDefaults.height)
            .clip(shape)
            .shimmer(colors),
    )
}

/** Circular placeholder, for an avatar. */
@Composable
public fun SkeletonCircle(
    modifier: Modifier = Modifier,
    size: Dp = SkeletonDefaults.circleSize,
    colors: SkeletonColors = SkeletonDefaults.colors(),
) {
    Skeleton(modifier.size(size), CircleShape, colors)
}

/** [lines] text-line placeholders; the last one is [lastLineFraction] wide. */
@Composable
public fun SkeletonText(
    modifier: Modifier = Modifier,
    lines: Int = 3,
    lastLineFraction: Float = SkeletonDefaults.LAST_LINE_FRACTION,
    shape: Shape = SkeletonDefaults.shape,
    colors: SkeletonColors = SkeletonDefaults.colors(),
) {
    Column(modifier.fillMaxWidth(), Arrangement.spacedBy(SkeletonDefaults.lineSpacing)) {
        repeat(lines) { index ->
            val width = if (index == lines - 1 && lines > 1) lastLineFraction else 1f
            Skeleton(Modifier.fillMaxWidth(width).height(SkeletonDefaults.height), shape, colors)
        }
    }
}

/**
 * Loading area made of skeletons. It is announced once as [label] (already localized, for example "Cargando") in a polite live
 * region; the skeletons inside stay decorative.
 *
 * ```
 * SkeletonGroup(label = "Cargando citas") {
 *     SkeletonCircle()
 *     SkeletonText(lines = 2)
 * }
 * ```
 */
@Composable
public fun SkeletonGroup(
    modifier: Modifier = Modifier,
    label: String = UiTheme.strings.loading,
    content: @Composable () -> Unit,
) {
    Column(
        modifier.semantics(mergeDescendants = true) {
            contentDescription = label
            liveRegion = LiveRegionMode.Polite
        },
        Arrangement.spacedBy(SkeletonDefaults.lineSpacing),
    ) { content() }
}
