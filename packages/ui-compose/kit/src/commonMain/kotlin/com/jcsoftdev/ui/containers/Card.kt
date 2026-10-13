package com.jcsoftdev.ui.containers

import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.atoms.Divider
import com.jcsoftdev.ui.atoms.LocalContentColor
import com.jcsoftdev.ui.atoms.dimWhenDisabled
import com.jcsoftdev.ui.foundation.pressScale
import com.jcsoftdev.ui.glass.GlassNesting
import com.jcsoftdev.ui.glass.LocalGlassState
import com.jcsoftdev.ui.glass.SurfaceMaterial
import com.jcsoftdev.ui.glass.SurfaceRole
import com.jcsoftdev.ui.glass.rememberResolvedMaterial
import com.jcsoftdev.ui.glass.surfaceMaterial
import com.jcsoftdev.ui.theme.UiTheme

/** Colors of a [Card]: fill, outline, the divider between slots and the footer text. */
@Immutable
public class CardColors(
    public val container: Color,
    public val border: Color,
    public val divider: Color,
    public val footerContent: Color,
) {
    /** Copy with selected colors replaced. */
    public fun copy(
        container: Color = this.container,
        border: Color = this.border,
        divider: Color = this.divider,
        footerContent: Color = this.footerContent,
    ): CardColors = CardColors(container, border, divider, footerContent)
}

/** Default colors, shape and metrics of [Card]. */
public object CardDefaults {
    /** Colors in the active theme. */
    @Composable
    @ReadOnlyComposable
    public fun colors(): CardColors {
        val c = UiTheme.colors
        return CardColors(c.surface, c.line, c.hair, c.ink3)
    }

    /** Corner shape; the theme `card` shape. */
    public val shape: Shape
        @Composable @ReadOnlyComposable
        get() = UiTheme.shapes.card

    /** Padding of the header slot. */
    public val headerPadding: PaddingValues
        @Composable @ReadOnlyComposable
        get() = PaddingValues(horizontal = UiTheme.sizes.space16, vertical = UiTheme.sizes.space12)

    /** Padding of the content slot. */
    public val contentPadding: PaddingValues
        @Composable @ReadOnlyComposable
        get() = PaddingValues(horizontal = UiTheme.sizes.space16, vertical = UiTheme.sizes.space14)

    /** Padding of the footer slot. */
    public val footerPadding: PaddingValues
        @Composable @ReadOnlyComposable
        get() = PaddingValues(horizontal = UiTheme.sizes.space16, vertical = UiTheme.sizes.space10)

    /** Least height of the header slot. */
    public val headerMinHeight: Dp = 50.dp

    /** Gap between the items of the header and footer rows. */
    public val slotSpacing: Dp
        @Composable @ReadOnlyComposable
        get() = UiTheme.sizes.space10
}

/**
 * Bordered surface with optional [header], [footer] and the [content] column in between. With [onClick] the whole card is one
 * button for accessibility (descendants merge, [Role.Button], [onClickLabel] names the action), it shrinks a little while pressed
 * and keeps working with a 48dp minimum height from its content.
 *
 * ```
 * Card(
 *     onClick = { open(order) },
 *     header = { Text("Pedido 1042", Modifier.weight(1f)); Chip("Pagado", tone = ChipTone.Success) },
 *     footer = { Text("Hoy, 10:30") },
 * ) { Text("Corte y barba") }
 * ```
 *
 * Restyle one card through [colors], [shape] and the slot paddings (start from [CardDefaults]).
 *
 * A card is content: always solid, even with `UiStyle.Glass`. Pass [material] to opt one card into glass (for example over a
 * photo); inside the app content a glass card is the translucent tint, and nested glass falls back to a near-solid fill.
 */
@Composable
public fun Card(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    enabled: Boolean = true,
    onClickLabel: String? = null,
    colors: CardColors = CardDefaults.colors(),
    shape: Shape = CardDefaults.shape,
    headerPadding: PaddingValues = CardDefaults.headerPadding,
    contentPadding: PaddingValues = CardDefaults.contentPadding,
    footerPadding: PaddingValues = CardDefaults.footerPadding,
    material: SurfaceMaterial? = null,
    header: (@Composable RowScope.() -> Unit)? = null,
    footer: (@Composable RowScope.() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val source = remember { MutableInteractionSource() }
    val spacing = CardDefaults.slotSpacing
    val resolved = rememberResolvedMaterial(material, SurfaceRole.Content)
    Column(
        modifier =
            modifier
                .then(
                    if (onClick != null) {
                        Modifier
                            .clickable(source, null, enabled, onClickLabel, Role.Button, onClick)
                            .pressScale(source)
                            .dimWhenDisabled(enabled)
                    } else {
                        Modifier
                    },
                ).surfaceMaterial(resolved, shape, colors.container, colors.border, LocalGlassState.current),
    ) {
        GlassNesting(resolved) {
            if (header != null) {
                Row(
                    Modifier.fillMaxWidth().defaultMinSize(minHeight = CardDefaults.headerMinHeight).padding(headerPadding),
                    Arrangement.spacedBy(spacing),
                    Alignment.CenterVertically,
                    content = header,
                )
                Divider(color = colors.divider)
            }
            Column(Modifier.fillMaxWidth().padding(contentPadding), content = content)
            if (footer != null) {
                Divider(color = colors.divider)
                CompositionLocalProvider(LocalContentColor provides colors.footerContent) {
                    Row(
                        Modifier.fillMaxWidth().padding(footerPadding),
                        Arrangement.spacedBy(spacing),
                        Alignment.CenterVertically,
                        content = footer,
                    )
                }
            }
        }
    }
}
