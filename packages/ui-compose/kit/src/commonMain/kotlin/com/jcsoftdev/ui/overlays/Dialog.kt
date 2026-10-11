package com.jcsoftdev.ui.overlays

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.FlowRowScope
import androidx.compose.foundation.layout.PaddingValues
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
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.focusRestorer
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.foundation.BackPriority
import com.jcsoftdev.ui.primitives.ModalLayer
import com.jcsoftdev.ui.primitives.OverlayMotion
import com.jcsoftdev.ui.primitives.initialFocus
import com.jcsoftdev.ui.primitives.rememberOverlayPresence
import com.jcsoftdev.ui.theme.UiTheme

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

    /** Enter (180ms) and exit (100ms) timing. */
    public val motion: OverlayMotion = OverlayMotion.Default

    /** Scale the card grows from while it enters. */
    public const val ENTER_SCALE: Float = 0.96f
}

/**
 * Centered modal dialog built on the headless [ModalLayer] and [initialFocus] primitives. Focus moves into it when it
 * opens, [title] is the pane title, and [description] and [content] sit between the title and the [actions] row; actions wrap onto further lines (end-aligned) when they do not fit, e.g. at large font scales.
 * [dismissOnScrim] and [dismissOnBack] decide whether a tap outside or system back call [onDismissRequest], which must set
 * [open] to false; a dialog can therefore require an explicit choice. [dismissLabel] (already localized) is the scrim's
 * accessibility action name. [motion] sets the enter and exit timing and [enterScale] the size the card grows from.
 */
@OptIn(ExperimentalComposeUiApi::class)
@Composable
public fun Dialog(
    open: Boolean,
    onDismissRequest: () -> Unit,
    title: String,
    modifier: Modifier = Modifier,
    description: String? = null,
    dismissOnScrim: Boolean = true,
    dismissOnBack: Boolean = true,
    dismissLabel: String? = UiTheme.strings.close,
    colors: DialogColors = DialogDefaults.colors(),
    shape: Shape = DialogDefaults.shape,
    maxWidth: Dp = DialogDefaults.maxWidth,
    contentPadding: PaddingValues = DialogDefaults.contentPadding,
    titleStyle: TextStyle = DialogDefaults.titleStyle,
    descriptionStyle: TextStyle = DialogDefaults.descriptionStyle,
    motion: OverlayMotion = DialogDefaults.motion,
    enterScale: Float = DialogDefaults.ENTER_SCALE,
    actions: (@Composable FlowRowScope.() -> Unit)? = null,
    content: (@Composable ColumnScope.() -> Unit)? = null,
) {
    val presence = rememberOverlayPresence(open, motion)
    ModalLayer(
        open = open,
        present = presence.present,
        onDismissRequest = onDismissRequest,
        dismissOnBack = dismissOnBack,
        dismissOnScrimTap = dismissOnScrim,
        dismissLabel = dismissLabel,
        backPriority = BackPriority.SHEET,
        captureFocus = false,
        scrim = { dismiss ->
            Box(
                Modifier
                    .fillMaxSize()
                    .graphicsLayer { alpha = presence.progress }
                    .background(colors.scrim)
                    .then(dismiss),
            )
        },
    ) {
        val sizes = UiTheme.sizes
        Box(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing), contentAlignment = Alignment.Center) {
            Column(
                modifier
                    .padding(DialogDefaults.margin)
                    .widthIn(max = maxWidth)
                    .fillMaxWidth()
                    .graphicsLayer {
                        alpha = presence.progress
                        val scale = enterScale + (1f - enterScale) * presence.progress
                        scaleX = scale
                        scaleY = scale
                    }.clip(shape)
                    .background(colors.container)
                    .border(sizes.borderWidth, colors.border, shape)
                    .pointerInput(Unit) { detectTapGestures { } }
                    .semantics { paneTitle = title }
                    .initialFocus()
                    .padding(contentPadding),
                verticalArrangement = Arrangement.spacedBy(sizes.space8),
            ) {
                Text(title, style = titleStyle, color = colors.title)
                if (description != null) Text(description, style = descriptionStyle, color = colors.description)
                if (content != null) {
                    Column(
                        Modifier.weight(1f, fill = false).focusRestorer().verticalScroll(rememberScrollState()),
                        verticalArrangement = Arrangement.spacedBy(sizes.space8),
                        content = content,
                    )
                }
                if (actions != null) {
                    FlowRow(
                        Modifier.fillMaxWidth().padding(top = sizes.space8),
                        horizontalArrangement = Arrangement.spacedBy(sizes.space8, Alignment.End),
                        verticalArrangement = Arrangement.spacedBy(sizes.space8),
                        itemVerticalAlignment = Alignment.CenterVertically,
                        content = actions,
                    )
                }
            }
        }
    }
}
