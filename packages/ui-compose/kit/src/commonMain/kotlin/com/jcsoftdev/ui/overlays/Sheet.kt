package com.jcsoftdev.ui.overlays

import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CornerBasedShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.shape.ZeroCornerSize
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.focusRestorer
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.traversalIndex
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.foundation.BackPriority
import com.jcsoftdev.ui.primitives.ModalLayer
import com.jcsoftdev.ui.primitives.OverlayMotion
import com.jcsoftdev.ui.primitives.SheetState
import com.jcsoftdev.ui.primitives.rememberOverlayPresence
import com.jcsoftdev.ui.primitives.rememberSheetState
import com.jcsoftdev.ui.primitives.sheetDraggable
import com.jcsoftdev.ui.primitives.sheetTranslation
import com.jcsoftdev.ui.theme.UiTheme

/** Colors of a [Sheet]: surface, scrim, grab handle, footer divider and title. */
@Immutable
public class SheetColors(
    public val container: Color,
    public val scrim: Color,
    public val handle: Color,
    public val divider: Color,
    public val title: Color,
) {
    /** Copy with selected colors replaced. */
    public fun copy(
        container: Color = this.container,
        scrim: Color = this.scrim,
        handle: Color = this.handle,
        divider: Color = this.divider,
        title: Color = this.title,
    ): SheetColors = SheetColors(container, scrim, handle, divider, title)
}

/** Default colors, shape and metrics of [Sheet]. */
public object SheetDefaults {
    /** Colors in the active theme. */
    @Composable
    @ReadOnlyComposable
    public fun colors(): SheetColors {
        val c = UiTheme.colors
        return SheetColors(c.float, c.scrim, c.lineStrong, c.hair, c.ink)
    }

    /** Shape; the theme `sheet` shape. Only its top corners show, the bottom ones are squared. */
    public val shape: CornerBasedShape
        @Composable @ReadOnlyComposable
        get() = UiTheme.shapes.sheet

    /** Widest the sheet grows on large screens. */
    public val maxWidth: Dp = 640.dp

    /** Smallest gap kept above the sheet below the top safe inset. */
    public val topGap: Dp = 24.dp

    /** Horizontal padding of the header, body and footer. */
    public val contentPadding: PaddingValues = PaddingValues(horizontal = 20.dp)

    /** Size of the grab handle. */
    public val handleSize: DpSize = DpSize(36.dp, 4.dp)

    /** Title style; the theme `dialogTitle`. */
    public val titleStyle: TextStyle
        @Composable @ReadOnlyComposable
        get() = UiTheme.typography.dialogTitle

    /** Enter (180ms) and exit (100ms) timing. */
    public val motion: OverlayMotion = OverlayMotion.Default
}

/**
 * Bottom sheet built on the headless [ModalLayer], [rememberSheetState] and [sheetDraggable] primitives. The handle and
 * [title] stay fixed on top, [content] scrolls in the space left inside the safe drawing insets (so the keyboard shrinks
 * the body instead of covering it) and [footer] stays pinned below it, so the primary action is always reachable however
 * long the body is.
 *
 * System back (kit back dispatcher, [BackPriority.SHEET]), a tap on the scrim and a downward swipe on the header call
 * [onDismiss] when [dismissible]; it must set [open] to false. [dismissLabel] (already localized) is the scrim's
 * accessibility action name; without it the scrim is not announced. The title is exposed as the pane title. [motion] sets
 * the enter and exit timing and [state] the drag-to-dismiss thresholds.
 */
@OptIn(ExperimentalComposeUiApi::class)
@Composable
public fun Sheet(
    open: Boolean,
    onDismiss: () -> Unit,
    title: String,
    modifier: Modifier = Modifier,
    dismissible: Boolean = true,
    dismissLabel: String? = null,
    colors: SheetColors = SheetDefaults.colors(),
    shape: CornerBasedShape = SheetDefaults.shape,
    maxWidth: Dp = SheetDefaults.maxWidth,
    topGap: Dp = SheetDefaults.topGap,
    contentPadding: PaddingValues = SheetDefaults.contentPadding,
    handleSize: DpSize = SheetDefaults.handleSize,
    titleStyle: TextStyle = SheetDefaults.titleStyle,
    motion: OverlayMotion = SheetDefaults.motion,
    state: SheetState = rememberSheetState(),
    footer: (@Composable ColumnScope.() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val presence = rememberOverlayPresence(open, motion)
    val currentOpen by rememberUpdatedState(open)
    LaunchedEffect(open) { if (open) state.reset() }
    ModalLayer(
        open = open,
        present = presence.present,
        onDismissRequest = onDismiss,
        dismissOnBack = dismissible,
        dismissOnScrimTap = dismissible,
        dismissLabel = dismissLabel,
        backPriority = BackPriority.SHEET,
        captureFocus = true,
        scrim = { dismiss ->
            Box(
                Modifier
                    .fillMaxSize()
                    .graphicsLayer { alpha = state.scrimAlpha(presence.progress) }
                    .background(colors.scrim)
                    .then(dismiss),
            )
        },
    ) {
        val sizes = UiTheme.sizes
        Box(
            Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Top)).padding(top = topGap),
            contentAlignment = Alignment.BottomCenter,
        ) {
            Column(
                modifier
                    .widthIn(max = maxWidth)
                    .fillMaxWidth()
                    .sheetTranslation(state) { presence.progress }
                    .clip(shape.copy(bottomStart = ZeroCornerSize, bottomEnd = ZeroCornerSize))
                    .background(colors.container)
                    .pointerInput(Unit) { detectTapGestures { } }
                    .semantics {
                        paneTitle = title
                        traversalIndex = 1f
                    }.windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Horizontal + WindowInsetsSides.Bottom)),
            ) {
                SheetHeader(title, titleStyle, colors, handleSize, contentPadding, dismissible, state, { currentOpen }, onDismiss)
                Column(
                    Modifier
                        .weight(1f, fill = false)
                        .focusRestorer()
                        .verticalScroll(rememberScrollState())
                        .padding(contentPadding),
                    content = content,
                )
                if (footer != null) {
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .drawBehind { drawRect(colors.divider, size = Size(size.width, sizes.borderWidth.toPx())) }
                            .padding(contentPadding)
                            .padding(vertical = sizes.space12),
                        content = footer,
                    )
                }
            }
        }
    }
}

@Composable
private fun SheetHeader(
    title: String,
    titleStyle: TextStyle,
    colors: SheetColors,
    handleSize: DpSize,
    contentPadding: PaddingValues,
    dismissible: Boolean,
    state: SheetState,
    isOpen: () -> Boolean,
    onDismiss: () -> Unit,
) {
    val sizes = UiTheme.sizes
    Column(
        Modifier
            .fillMaxWidth()
            .sheetDraggable(state, onDismiss, enabled = dismissible, isOpen = isOpen)
            .padding(contentPadding),
    ) {
        Box(
            Modifier
                .align(Alignment.CenterHorizontally)
                .padding(top = sizes.space10, bottom = sizes.space12)
                .size(handleSize)
                .clip(RoundedCornerShape(50))
                .background(colors.handle),
        )
        Text(title, Modifier.padding(bottom = sizes.space12), style = titleStyle, color = colors.title)
    }
}
