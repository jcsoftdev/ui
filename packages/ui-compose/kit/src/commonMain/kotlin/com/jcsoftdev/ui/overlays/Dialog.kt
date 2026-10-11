package com.jcsoftdev.ui.overlays

import androidx.compose.animation.core.Animatable
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.focusable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.foundation.BackHandler
import com.jcsoftdev.ui.foundation.BackPriority
import com.jcsoftdev.ui.foundation.Motion
import com.jcsoftdev.ui.theme.UiShapes
import com.jcsoftdev.ui.theme.UiTheme
import com.jcsoftdev.ui.theme.UiTypography

private const val ENTER_SCALE = 0.96f

/**
 * Centered modal dialog. Focus moves into it when it opens, [title] is the pane title, and [description] and [content]
 * sit between the title and the [actions] row. [dismissOnScrim] and [dismissOnBack] decide whether a tap outside or
 * system back call [onDismissRequest], which must set [open] to false; a dialog can therefore require an explicit
 * choice. [dismissLabel] (already localized) is the scrim's accessibility action name.
 */
@Composable
public fun Dialog(
    open: Boolean,
    onDismissRequest: () -> Unit,
    title: String,
    modifier: Modifier = Modifier,
    description: String? = null,
    dismissOnScrim: Boolean = true,
    dismissOnBack: Boolean = true,
    dismissLabel: String? = null,
    actions: (@Composable RowScope.() -> Unit)? = null,
    content: (@Composable ColumnScope.() -> Unit)? = null,
) {
    val motion = UiTheme.motion
    val shown = remember { Animatable(0f) }
    val currentDismiss by rememberUpdatedState(onDismissRequest)
    var present by remember { mutableStateOf(open) }
    LaunchedEffect(open) {
        if (open) {
            present = true
            shown.animateTo(1f, motion.tween(Motion.STANDARD))
        } else {
            shown.animateTo(0f, motion.tween(Motion.FAST))
            present = false
        }
    }
    BackHandler(enabled = open, priority = BackPriority.SHEET) { if (dismissOnBack) onDismissRequest() }
    OverlayLayerEffect(active = present, modal = true) {
        val colors = UiTheme.colors
        val focus = remember { FocusRequester() }
        LaunchedEffect(Unit) { runCatching { focus.requestFocus() } }
        Box(Modifier.fillMaxSize()) {
            Box(
                Modifier
                    .fillMaxSize()
                    .graphicsLayer { alpha = shown.value }
                    .background(colors.scrim)
                    .pointerInput(dismissOnScrim) { detectTapGestures { if (dismissOnScrim) currentDismiss() } }
                    .semantics {
                        if (dismissOnScrim && dismissLabel != null) {
                            contentDescription = dismissLabel
                            onClick(dismissLabel) {
                                onDismissRequest()
                                true
                            }
                        }
                    },
            )
            Box(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing), contentAlignment = Alignment.Center) {
                Column(
                    modifier
                        .padding(horizontal = 20.dp, vertical = 24.dp)
                        .widthIn(max = 420.dp)
                        .fillMaxWidth()
                        .graphicsLayer {
                            alpha = shown.value
                            val scale = ENTER_SCALE + (1f - ENTER_SCALE) * shown.value
                            scaleX = scale
                            scaleY = scale
                        }.clip(UiShapes.dialog)
                        .background(colors.float)
                        .border(1.dp, colors.hair, UiShapes.dialog)
                        .pointerInput(Unit) { detectTapGestures { } }
                        .semantics { paneTitle = title }
                        .focusRequester(focus)
                        .focusable()
                        .padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text(title, style = UiTypography.dialogTitle)
                    if (description != null) Text(description, color = colors.ink2)
                    if (content != null) {
                        Column(
                            Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState()),
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                            content = content,
                        )
                    }
                    if (actions != null) {
                        Row(
                            Modifier.fillMaxWidth().padding(top = 8.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End),
                            verticalAlignment = Alignment.CenterVertically,
                            content = actions,
                        )
                    }
                }
            }
        }
    }
}
