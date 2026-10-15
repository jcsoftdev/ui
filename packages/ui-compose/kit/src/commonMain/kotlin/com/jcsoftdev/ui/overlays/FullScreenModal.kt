package com.jcsoftdev.ui.overlays

import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.traversalIndex
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.atoms.IconButton
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.icons.ArrowLeft
import com.jcsoftdev.ui.icons.Icon
import com.jcsoftdev.ui.icons.Icons
import com.jcsoftdev.ui.primitives.OverlayLayer
import com.jcsoftdev.ui.primitives.OverlayMotion
import com.jcsoftdev.ui.primitives.initialFocus
import com.jcsoftdev.ui.primitives.rememberOverlayPresence
import com.jcsoftdev.ui.theme.UiTheme

/** Colors of a [FullScreenModal]: page fill, header divider and title. */
@Immutable
public class FullScreenModalColors(
    public val container: Color,
    public val divider: Color,
    public val title: Color,
) {
    /** Copy with selected colors replaced. */
    public fun copy(
        container: Color = this.container,
        divider: Color = this.divider,
        title: Color = this.title,
    ): FullScreenModalColors = FullScreenModalColors(container, divider, title)
}

/** Default colors and metrics of [FullScreenModal]. */
public object FullScreenModalDefaults {
    /** Colors in the active theme: the page background, a hairline under the header and the ink title. */
    @Composable
    @ReadOnlyComposable
    public fun colors(): FullScreenModalColors {
        val c = UiTheme.colors
        return FullScreenModalColors(c.bg, c.hair, c.ink)
    }

    /** Height of the header content, below the status bar inset. */
    public val headerHeight: Dp = 56.dp

    /** Padding of the header content. */
    public val headerPadding: PaddingValues = PaddingValues(horizontal = 8.dp)

    /** Padding of the body. */
    public val contentPadding: PaddingValues = PaddingValues(horizontal = 20.dp, vertical = 16.dp)

    /** Title style; the theme `dialogTitle`. */
    public val titleStyle: TextStyle
        @Composable @ReadOnlyComposable
        get() = UiTheme.typography.dialogTitle

    /** Enter (180ms) and exit (100ms) timing: the page slides up from the bottom edge. */
    public val motion: OverlayMotion = OverlayMotion.Default
}

/**
 * A full-screen sub-screen drawn over the app, like [Sheet] but covering the whole window: a header with a back button, the
 * [title] and optional [actions], a body and an optional pinned [footer] (for example a [com.jcsoftdev.ui.navigation.BottomActionBar]).
 *
 * It is a modal layer, so while it is open:
 * - everything behind it, and every layer below it, is hidden from accessibility and cannot take focus or touches;
 * - focus moves to the header title when it opens, and returns to the element that had it when it closes;
 * - the title is exposed as the pane title and as a heading, so a screen reader announces the new screen;
 * - system back (kit back dispatcher, [com.jcsoftdev.ui.foundation.BackPriority.SHEET]) and the header back button call
 *   [onDismiss] when [dismissible]; it must set [open] to false. A [Sheet] or dialog opened over it answers back first.
 *
 * The page slides up with the theme motion (a jump cut with reduced motion). The body scrolls unless [scrollable] is false
 * (pass false when the content is a lazy list or manages its own scrolling). The window insets are applied for you, so the
 * keyboard shrinks the body and the footer stays above it. [backLabel] is the back button's description (already localized).
 *
 * ```
 * FullScreenModal(open = editing, onDismiss = { editing = false }, title = "Editar cita", footer = {
 *     BottomActionBar { Button("Guardar", ::save, variant = ButtonVariant.Primary, modifier = Modifier.weight(1f)) }
 * }) { ... fields ... }
 * ```
 */
@Composable
public fun FullScreenModal(
    open: Boolean,
    onDismiss: () -> Unit,
    title: String,
    modifier: Modifier = Modifier,
    dismissible: Boolean = true,
    scrollable: Boolean = true,
    backLabel: String = UiTheme.strings.back,
    colors: FullScreenModalColors = FullScreenModalDefaults.colors(),
    headerHeight: Dp = FullScreenModalDefaults.headerHeight,
    headerPadding: PaddingValues = FullScreenModalDefaults.headerPadding,
    contentPadding: PaddingValues = FullScreenModalDefaults.contentPadding,
    titleStyle: TextStyle = FullScreenModalDefaults.titleStyle,
    motion: OverlayMotion = FullScreenModalDefaults.motion,
    actions: (@Composable RowScope.() -> Unit)? = null,
    footer: (@Composable ColumnScope.() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val presence = rememberOverlayPresence(open, motion)
    val sizes = UiTheme.sizes
    OverlayLayer(
        visible = presence.present,
        onDismissRequest = onDismiss,
        modal = true,
        dismissOnBack = dismissible,
        backEnabled = open,
        captureFocus = false,
    ) {
        Column(
            modifier
                .fillMaxSize()
                .graphicsLayer {
                    translationY = (1f - presence.progress) * size.height
                    alpha = presence.progress
                }.background(colors.container)
                .pointerInput(Unit) { detectTapGestures { } }
                .semantics {
                    paneTitle = title
                    traversalIndex = 1f
                }.windowInsetsPadding(WindowInsets.safeDrawing),
        ) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .drawBehind {
                        drawRect(
                            colors.divider,
                            topLeft =
                                androidx.compose.ui.geometry.Offset(
                                    0f,
                                    size.height - sizes.borderWidth.toPx(),
                                ),
                            size = Size(size.width, sizes.borderWidth.toPx()),
                        )
                    }.defaultMinSize(minHeight = headerHeight)
                    .padding(headerPadding),
                horizontalArrangement = Arrangement.spacedBy(sizes.space8),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (dismissible) IconButton(onDismiss, backLabel) { Icon(Icons.ArrowLeft, contentDescription = null) }
                Text(
                    title,
                    Modifier
                        .weight(1f)
                        .padding(horizontal = sizes.space8)
                        .initialFocus()
                        .semantics { heading() },
                    style = titleStyle,
                    color = colors.title,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                if (actions != null) actions()
            }
            Column(
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .then(if (scrollable) Modifier.verticalScroll(rememberScrollState()) else Modifier)
                    .padding(contentPadding),
                content = content,
            )
            if (footer != null) Column(Modifier.fillMaxWidth(), content = footer)
        }
    }
}
