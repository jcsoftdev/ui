package com.jcsoftdev.ui.overlays

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animate
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.draggable
import androidx.compose.foundation.gestures.rememberDraggableState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
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
import androidx.compose.runtime.MutableFloatState
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.traversalIndex
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.foundation.BackHandler
import com.jcsoftdev.ui.foundation.BackPriority
import com.jcsoftdev.ui.foundation.Motion
import com.jcsoftdev.ui.theme.UiTheme

private const val DISMISS_FRACTION = 0.35f
private const val DISMISS_VELOCITY = 1200f

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
}

/**
 * Bottom sheet. The handle and [title] stay fixed on top, [content] scrolls in the space left inside the safe drawing
 * insets (so the keyboard shrinks the body instead of covering it) and [footer] stays pinned below it, so the primary
 * action is always reachable however long the body is.
 *
 * System back (kit back dispatcher, [BackPriority.SHEET]), a tap on the scrim and a downward swipe on the header call
 * [onDismiss] when [dismissible]; it must set [open] to false. [dismissLabel] (already localized) is the scrim's
 * accessibility action name; without it the scrim is not announced. The title is exposed as the pane title.
 */
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
    footer: (@Composable ColumnScope.() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val motion = UiTheme.motion
    val shown = remember { Animatable(0f) }
    val drag = remember { mutableFloatStateOf(0f) }
    val height = remember { mutableFloatStateOf(0f) }
    val currentDismiss by rememberUpdatedState(onDismiss)
    val currentOpen by rememberUpdatedState(open)
    var present by remember { mutableStateOf(open) }
    LaunchedEffect(open) {
        if (open) {
            present = true
            drag.floatValue = 0f
            shown.animateTo(1f, motion.tween(Motion.STANDARD))
        } else {
            shown.animateTo(0f, motion.tween(Motion.FAST))
            present = false
        }
    }
    BackHandler(enabled = open, priority = BackPriority.SHEET) { if (dismissible) onDismiss() }
    OverlayLayerEffect(active = present, modal = true) {
        val sizes = UiTheme.sizes
        Box(Modifier.fillMaxSize()) {
            Box(
                Modifier
                    .fillMaxSize()
                    .graphicsLayer {
                        val h = height.floatValue
                        alpha = shown.value * (if (h > 0f) 1f - (drag.floatValue / h).coerceIn(0f, 1f) else 1f)
                    }.background(colors.scrim)
                    .pointerInput(dismissible) { detectTapGestures { if (dismissible) currentDismiss() } }
                    .semantics {
                        if (dismissible && dismissLabel != null) {
                            contentDescription = dismissLabel
                            onClick(dismissLabel) {
                                onDismiss()
                                true
                            }
                        }
                    },
            )
            Box(
                Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Top)).padding(top = topGap),
                contentAlignment = Alignment.BottomCenter,
            ) {
                Column(
                    modifier
                        .widthIn(max = maxWidth)
                        .fillMaxWidth()
                        .graphicsLayer { translationY = (1f - shown.value) * height.floatValue + drag.floatValue }
                        .onSizeChanged { height.floatValue = it.height.toFloat() }
                        .clip(shape.copy(bottomStart = ZeroCornerSize, bottomEnd = ZeroCornerSize))
                        .background(colors.container)
                        .pointerInput(Unit) { detectTapGestures { } }
                        .semantics {
                            paneTitle = title
                            traversalIndex = 1f
                        }.windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Horizontal + WindowInsetsSides.Bottom)),
                ) {
                    SheetHeader(
                        title,
                        titleStyle,
                        colors,
                        handleSize,
                        contentPadding,
                        dismissible,
                        drag,
                        height,
                        { currentOpen },
                        onDismiss,
                    )
                    Column(
                        Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState()).padding(contentPadding),
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
}

@Composable
private fun SheetHeader(
    title: String,
    titleStyle: TextStyle,
    colors: SheetColors,
    handleSize: DpSize,
    contentPadding: PaddingValues,
    dismissible: Boolean,
    drag: MutableFloatState,
    height: MutableFloatState,
    isOpen: () -> Boolean,
    onDismiss: () -> Unit,
) {
    val sizes = UiTheme.sizes
    val motion = UiTheme.motion
    val draggable =
        rememberDraggableState { delta -> drag.floatValue = (drag.floatValue + delta).coerceAtLeast(0f) }
    Column(
        Modifier
            .fillMaxWidth()
            .draggable(
                state = draggable,
                orientation = Orientation.Vertical,
                enabled = dismissible,
                onDragStopped = { velocity ->
                    if (drag.floatValue > height.floatValue * DISMISS_FRACTION || velocity > DISMISS_VELOCITY) {
                        onDismiss()
                        // Two frames let the parent's recomposition land; if it kept the sheet open, bring it back.
                        withFrameNanos { }
                        withFrameNanos { }
                    }
                    if (isOpen()) {
                        animate(drag.floatValue, 0f, animationSpec = motion.tween(Motion.STANDARD)) { value, _ -> drag.floatValue = value }
                    }
                },
            ).padding(contentPadding),
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
