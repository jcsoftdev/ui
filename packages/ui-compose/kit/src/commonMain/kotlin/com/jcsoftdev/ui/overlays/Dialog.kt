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
import androidx.compose.foundation.layout.PaddingValues
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
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.ReadOnlyComposable
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.foundation.BackHandler
import com.jcsoftdev.ui.foundation.BackPriority
import com.jcsoftdev.ui.foundation.Motion
import com.jcsoftdev.ui.theme.UiTheme

private const val ENTER_SCALE = 0.96f

/** Colors of a [Dialog]: surface, outline, scrim, title and description. */
@Immutable
public class DialogColors(
    public val container: Color,
    public val border: Color,
    public val scrim: Color,
    public val title: Color,
    public val description: Color,
) {
    /** Copy with selected colors replaced. */
    public fun copy(
        container: Color = this.container,
        border: Color = this.border,
        scrim: Color = this.scrim,
        title: Color = this.title,
        description: Color = this.description,
    ): DialogColors = DialogColors(container, border, scrim, title, description)
}

/** Default colors, shape and metrics of [Dialog]. */
public object DialogDefaults {
    /** Colors in the active theme. */
    @Composable
    @ReadOnlyComposable
    public fun colors(): DialogColors {
        val c = UiTheme.colors
        return DialogColors(c.float, c.hair, c.scrim, c.ink, c.ink2)
    }

    /** Shape; the theme `dialog` shape. */
    public val shape: Shape
        @Composable @ReadOnlyComposable
        get() = UiTheme.shapes.dialog

    /** Widest the dialog grows. */
    public val maxWidth: Dp = 420.dp

    /** Padding inside the card. */
    public val contentPadding: PaddingValues = PaddingValues(20.dp)

    /** Margin between the card and the window edges. */
    public val margin: PaddingValues = PaddingValues(horizontal = 20.dp, vertical = 24.dp)

    /** Title style; the theme `dialogTitle`. */
    public val titleStyle: TextStyle
        @Composable @ReadOnlyComposable
        get() = UiTheme.typography.dialogTitle

    /** Description style; the theme `body`. */
    public val descriptionStyle: TextStyle
        @Composable @ReadOnlyComposable
        get() = UiTheme.typography.body
}

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
    colors: DialogColors = DialogDefaults.colors(),
    shape: Shape = DialogDefaults.shape,
    maxWidth: Dp = DialogDefaults.maxWidth,
    contentPadding: PaddingValues = DialogDefaults.contentPadding,
    titleStyle: TextStyle = DialogDefaults.titleStyle,
    descriptionStyle: TextStyle = DialogDefaults.descriptionStyle,
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
        val sizes = UiTheme.sizes
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
                        .padding(DialogDefaults.margin)
                        .widthIn(max = maxWidth)
                        .fillMaxWidth()
                        .graphicsLayer {
                            alpha = shown.value
                            val scale = ENTER_SCALE + (1f - ENTER_SCALE) * shown.value
                            scaleX = scale
                            scaleY = scale
                        }.clip(shape)
                        .background(colors.container)
                        .border(sizes.borderWidth, colors.border, shape)
                        .pointerInput(Unit) { detectTapGestures { } }
                        .semantics { paneTitle = title }
                        .focusRequester(focus)
                        .focusable()
                        .padding(contentPadding),
                    verticalArrangement = Arrangement.spacedBy(sizes.space8),
                ) {
                    Text(title, style = titleStyle, color = colors.title)
                    if (description != null) Text(description, style = descriptionStyle, color = colors.description)
                    if (content != null) {
                        Column(
                            Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState()),
                            verticalArrangement = Arrangement.spacedBy(sizes.space8),
                            content = content,
                        )
                    }
                    if (actions != null) {
                        Row(
                            Modifier.fillMaxWidth().padding(top = sizes.space8),
                            horizontalArrangement = Arrangement.spacedBy(sizes.space8, Alignment.End),
                            verticalAlignment = Alignment.CenterVertically,
                            content = actions,
                        )
                    }
                }
            }
        }
    }
}
