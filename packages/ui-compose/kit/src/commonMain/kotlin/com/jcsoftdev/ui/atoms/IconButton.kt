package com.jcsoftdev.ui.atoms

import androidx.compose.foundation.background
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import com.jcsoftdev.ui.theme.UiShapes
import com.jcsoftdev.ui.theme.UiTheme

/** Square icon-only button; [contentDescription] is required because there is no visible label. */
@Composable
public fun IconButton(
    onClick: () -> Unit,
    contentDescription: String,
    modifier: Modifier = Modifier,
    variant: ButtonVariant = ButtonVariant.Ghost,
    size: ButtonSize = ButtonSize.Md,
    enabled: Boolean = true,
    content: @Composable () -> Unit,
) {
    val colors = UiTheme.colors
    val source = remember { MutableInteractionSource() }
    Box(
        modifier =
            modifier
                .pressableTarget(onClick, enabled, Role.Button, source)
                .semantics { this.contentDescription = contentDescription }
                .graphicsLayer { alpha = if (enabled) 1f else DISABLED_ALPHA }
                .size(size.height())
                .clip(UiShapes.control)
                .background(variant.container(colors)),
        contentAlignment = Alignment.Center,
    ) {
        CompositionLocalProvider(LocalContentColor provides variant.content(colors), content = content)
    }
}
