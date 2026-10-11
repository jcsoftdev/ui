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
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.ZeroCornerSize
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.MutableFloatState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.traversalIndex
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.foundation.BackHandler
import com.jcsoftdev.ui.foundation.BackPriority
import com.jcsoftdev.ui.foundation.Motion
import com.jcsoftdev.ui.theme.UiShapes
import com.jcsoftdev.ui.theme.UiTheme
import com.jcsoftdev.ui.theme.UiTypography

private const val DISMISS_FRACTION = 0.35f
private const val DISMISS_VELOCITY = 1200f

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
    footer: (@Composable ColumnScope.() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val motion = UiTheme.motion
    val shown = remember { Animatable(0f) }
    val drag = remember { mutableFloatStateOf(0f) }
    val height = remember { mutableFloatStateOf(0f) }
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
    OverlayLayerEffect(active = present) {
        val colors = UiTheme.colors
        Box(Modifier.fillMaxSize()) {
            Box(
                Modifier
                    .fillMaxSize()
                    .graphicsLayer {
                        val h = height.floatValue
                        alpha = shown.value * (if (h > 0f) 1f - (drag.floatValue / h).coerceIn(0f, 1f) else 1f)
                    }.background(colors.scrim)
                    .pointerInput(dismissible) { detectTapGestures { if (dismissible) onDismiss() } }
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
                Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Top)).padding(top = 24.dp),
                contentAlignment = Alignment.BottomCenter,
            ) {
                Column(
                    modifier
                        .widthIn(max = 640.dp)
                        .fillMaxWidth()
                        .graphicsLayer { translationY = (1f - shown.value) * height.floatValue + drag.floatValue }
                        .onSizeChanged { height.floatValue = it.height.toFloat() }
                        .clip(UiShapes.sheet.copy(bottomStart = ZeroCornerSize, bottomEnd = ZeroCornerSize))
                        .background(colors.float)
                        .pointerInput(Unit) { detectTapGestures { } }
                        .semantics {
                            paneTitle = title
                            traversalIndex = 1f
                        }.windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Horizontal + WindowInsetsSides.Bottom)),
                ) {
                    SheetHeader(title, dismissible, drag, height, onDismiss)
                    Column(
                        Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState()).padding(horizontal = 20.dp),
                        content = content,
                    )
                    if (footer != null) {
                        Column(
                            Modifier
                                .fillMaxWidth()
                                .drawBehind { drawRect(colors.hair, size = Size(size.width, 1.dp.toPx())) }
                                .padding(horizontal = 20.dp, vertical = 12.dp),
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
    dismissible: Boolean,
    drag: MutableFloatState,
    height: MutableFloatState,
    onDismiss: () -> Unit,
) {
    val colors = UiTheme.colors
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
                    } else {
                        animate(drag.floatValue, 0f, animationSpec = motion.tween(Motion.STANDARD)) { value, _ -> drag.floatValue = value }
                    }
                },
            ).padding(horizontal = 20.dp),
    ) {
        Box(
            Modifier
                .align(Alignment.CenterHorizontally)
                .padding(top = 10.dp, bottom = 12.dp)
                .height(4.dp)
                .width(36.dp)
                .clip(UiShapes.pill)
                .background(colors.lineStrong),
        )
        Text(title, Modifier.padding(bottom = 12.dp), style = UiTypography.dialogTitle)
    }
}
