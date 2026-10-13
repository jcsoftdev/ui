package com.jcsoftdev.ui.navigation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.glass.GlassNesting
import com.jcsoftdev.ui.glass.GlassState
import com.jcsoftdev.ui.glass.LocalGlassState
import com.jcsoftdev.ui.glass.SurfaceMaterial
import com.jcsoftdev.ui.glass.SurfaceRole
import com.jcsoftdev.ui.glass.rememberResolvedMaterial
import com.jcsoftdev.ui.glass.surfaceMaterial
import com.jcsoftdev.ui.theme.UiTheme

/** Colors of a [TopBar] or [ActionBar]: surface, outline and title. */
@Immutable
public class BarColors(
    public val container: Color,
    public val border: Color,
    public val title: Color,
) {
    /** Copy with selected colors replaced. */
    public fun copy(
        container: Color = this.container,
        border: Color = this.border,
        title: Color = this.title,
    ): BarColors = BarColors(container, border, title)
}

/** Default colors, shapes and metrics of [TopBar] and [ActionBar]. */
public object BarDefaults {
    /** Colors in the active theme. */
    @Composable
    @ReadOnlyComposable
    public fun colors(): BarColors {
        val c = UiTheme.colors
        return BarColors(c.float, c.hair, c.ink)
    }

    /** Full-bleed top bar: no rounding. */
    public val topBarShape: Shape = RectangleShape

    /** Floating action bar: a capsule, concentric with the controls inside. */
    public val actionBarShape: Shape = RoundedCornerShape(percent = 50)

    /** Height of the top bar content, below the status bar inset. */
    public val topBarHeight: Dp = 56.dp

    /** Padding of the top bar content. */
    public val topBarPadding: PaddingValues = PaddingValues(horizontal = 8.dp)

    /** Padding inside the action bar capsule. */
    public val actionBarPadding: PaddingValues = PaddingValues(horizontal = 8.dp, vertical = 4.dp)
}

/**
 * A top app bar: [navigation] slot, [title] and [actions]. It is chrome, so it is Liquid Glass with
 * `UiTheme(style = UiStyle.Glass)` and opaque otherwise; [material] overrides that.
 *
 * To blur the content that scrolls under the bar, mark that content with [com.jcsoftdev.ui.glass.glassSource] and pass the
 * same [glass] state; the bar must be drawn after (above) the content. Without [glass] the bar is the translucent tint.
 *
 * ```
 * val glass = rememberGlassState()
 * Box(Modifier.fillMaxSize()) {
 *     LazyColumn(Modifier.glassSource(glass), contentPadding = PaddingValues(top = 56.dp)) { ... }
 *     TopBar("Inbox", glass = glass, material = SurfaceMaterial.Glass)
 * }
 * ```
 */
@Composable
public fun TopBar(
    title: String,
    modifier: Modifier = Modifier,
    navigation: (@Composable () -> Unit)? = null,
    actions: (@Composable RowScope.() -> Unit)? = null,
    material: SurfaceMaterial? = null,
    glass: GlassState? = LocalGlassState.current,
    colors: BarColors = BarDefaults.colors(),
    shape: Shape = BarDefaults.topBarShape,
    height: Dp = BarDefaults.topBarHeight,
    contentPadding: PaddingValues = BarDefaults.topBarPadding,
) {
    val resolved = rememberResolvedMaterial(material, SurfaceRole.Chrome, glass)
    val sizes = UiTheme.sizes
    Row(
        modifier
            .fillMaxWidth()
            .surfaceMaterial(resolved, shape, colors.container, colors.border, glass)
            .windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Top + WindowInsetsSides.Horizontal))
            .defaultMinSize(minHeight = height)
            .padding(contentPadding),
        horizontalArrangement = Arrangement.spacedBy(sizes.space8),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        GlassNesting(resolved) {
            if (navigation != null) navigation()
            Text(
                title,
                Modifier.weight(1f).padding(horizontal = sizes.space8).semantics { heading() },
                style = UiTheme.typography.dialogTitle,
                color = colors.title,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            if (actions != null) actions()
        }
    }
}

/**
 * A floating capsule of controls (for example a bottom toolbar of icon buttons) over content. Chrome like [TopBar]: glass
 * with `UiStyle.Glass`, opaque otherwise; pass the [glass] state of the content below to blur it.
 */
@Composable
public fun ActionBar(
    modifier: Modifier = Modifier,
    material: SurfaceMaterial? = null,
    glass: GlassState? = LocalGlassState.current,
    colors: BarColors = BarDefaults.colors(),
    shape: Shape = BarDefaults.actionBarShape,
    contentPadding: PaddingValues = BarDefaults.actionBarPadding,
    content: @Composable RowScope.() -> Unit,
) {
    val resolved = rememberResolvedMaterial(material, SurfaceRole.Chrome, glass)
    Row(
        modifier
            .surfaceMaterial(resolved, shape, colors.container, colors.border, glass)
            .padding(contentPadding),
        horizontalArrangement = Arrangement.spacedBy(UiTheme.sizes.space4),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        GlassNesting(resolved) { content() }
    }
}
