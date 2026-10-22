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
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics

/** Square icon-only button; [contentDescription] is required because there is no visible label. Restyle with [colors], [disabledColors] (used while disabled, instead of dimming) and [shape]. */
@Composable
public fun IconButton(
    onClick: () -> Unit,
    contentDescription: String,
    modifier: Modifier = Modifier,
    variant: ButtonVariant = ButtonVariant.Ghost,
    size: ButtonSize = ButtonSize.Md,
    enabled: Boolean = true,
    colors: ButtonColors = ButtonDefaults.colors(variant),
    disabledColors: ButtonColors = ButtonDefaults.disabledColors(variant),
    shape: Shape = ButtonDefaults.shape,
    content: @Composable () -> Unit,
) {
    val source = remember { MutableInteractionSource() }
    val shown = if (enabled) colors else disabledColors
    Box(
        modifier =
            modifier
                .pressableTarget(onClick, enabled, Role.Button, source)
                .semantics { this.contentDescription = contentDescription }
                .size(ButtonDefaults.height(size))
                .clip(shape)
                .background(shown.container),
        contentAlignment = Alignment.Center,
    ) {
        CompositionLocalProvider(LocalContentColor provides shown.content, content = content)
    }
}
