package com.jcsoftdev.ui.navigation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.semantics.isTraversalGroup
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.glass.GlassNesting
import com.jcsoftdev.ui.glass.GlassState
import com.jcsoftdev.ui.glass.LocalGlassState
import com.jcsoftdev.ui.glass.SurfaceMaterial
import com.jcsoftdev.ui.glass.SurfaceRole
import com.jcsoftdev.ui.glass.rememberResolvedMaterial
import com.jcsoftdev.ui.glass.surfaceMaterial
import com.jcsoftdev.ui.theme.UiTheme

/** Default shape and metrics of [BottomActionBar]; the colors are [BarDefaults.colors]. */
public object BottomActionBarDefaults {
    /** Full-width bar: no rounding. */
    public val shape: Shape = RectangleShape

    /** Padding of the actions inside the bar, above the system inset. */
    public val contentPadding: PaddingValues = PaddingValues(horizontal = 16.dp, vertical = 12.dp)
}

/**
 * A bar pinned to the bottom of a screen for its primary actions, typically a full-width [com.jcsoftdev.ui.atoms.Button] (give it
 * `Modifier.weight(1f)`) next to a secondary one. Place it at the bottom of the screen layout, below the scrolling content, so
 * the actions never scroll away.
 *
 * Insets: the bar pads itself by the side and bottom safe-drawing insets, so it clears the gesture/navigation bar and rises
 * above the keyboard. When an app dock (a bottom navigation bar) is drawn over the same screen area, pass the dock's total
 * [dockHeight] (including the system inset the dock pads itself): the bar then sits on top of the dock instead of under it, and
 * still rises above the keyboard, which covers the dock. When the dock is a sibling below the bar in a `Column`, leave
 * [dockHeight] at 0, the layout already stacks them.
 *
 * It is chrome like [TopBar]: glass with `UiStyle.Glass`, opaque otherwise; [material] overrides that and [glass] blurs the
 * content below. The actions form one traversal group, so a screen reader reads them together after the content.
 *
 * ```
 * Box(Modifier.fillMaxSize()) {
 *     LazyColumn(Modifier.fillMaxSize()) { ... }
 *     BottomActionBar(Modifier.align(Alignment.BottomCenter), dockHeight = 64.dp) {
 *         Button("Cancelar", onCancel)
 *         Button("Confirmar", onConfirm, variant = ButtonVariant.Primary, modifier = Modifier.weight(1f))
 *     }
 *     Dock(Modifier.align(Alignment.BottomCenter).height(64.dp))
 * }
 * ```
 */
@Composable
public fun BottomActionBar(
    modifier: Modifier = Modifier,
    dockHeight: Dp = 0.dp,
    material: SurfaceMaterial? = null,
    glass: GlassState? = LocalGlassState.current,
    colors: BarColors = BarDefaults.colors(),
    shape: Shape = BottomActionBarDefaults.shape,
    contentPadding: PaddingValues = BottomActionBarDefaults.contentPadding,
    content: @Composable RowScope.() -> Unit,
) {
    val resolved = rememberResolvedMaterial(material, SurfaceRole.Chrome, glass)
    val docked = dockHeight > 0.dp
    val lift = if (docked) maxOf(dockHeight, WindowInsets.ime.asPaddingValues().calculateBottomPadding()) else 0.dp
    val insetSides = if (docked) WindowInsetsSides.Horizontal else WindowInsetsSides.Horizontal + WindowInsetsSides.Bottom
    Box(
        Modifier
            .padding(bottom = lift)
            .then(modifier)
            .fillMaxWidth()
            .semantics { isTraversalGroup = true },
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .surfaceMaterial(resolved, shape, colors.container, colors.border, glass)
                .windowInsetsPadding(WindowInsets.safeDrawing.only(insetSides))
                .padding(contentPadding),
            horizontalArrangement = Arrangement.spacedBy(UiTheme.sizes.space8),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            GlassNesting(resolved) { content() }
        }
    }
}
