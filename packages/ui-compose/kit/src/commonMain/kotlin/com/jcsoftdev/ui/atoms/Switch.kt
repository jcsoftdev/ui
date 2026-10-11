package com.jcsoftdev.ui.atoms

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.toggleable
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.foundation.Motion
import com.jcsoftdev.ui.theme.UiTheme

/** Controlled on/off switch; 34x20dp visual inside a 48dp touch target. [contentDescription] names it for screen readers. */
@Composable
public fun Switch(
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    contentDescription: String? = null,
) {
    val colors = UiTheme.colors
    val source = remember { MutableInteractionSource() }
    val progress = animateFloatAsState(if (checked) 1f else 0f, UiTheme.motion.tween(Motion.STANDARD), label = "switch")
    Box(
        modifier
            .toggleable(checked, source, null, enabled, Role.Switch, onCheckedChange)
            .minimumTouchTarget()
            .semantics { if (contentDescription != null) this.contentDescription = contentDescription }
            .graphicsLayer { alpha = if (enabled) 1f else DISABLED_ALPHA }
            .size(34.dp, 20.dp)
            .drawBehind {
                val p = progress.value
                drawRoundRect(lerp(colors.lineStrong, colors.accent, p), cornerRadius = CornerRadius(size.height / 2))
                val radius = 7.dp.toPx()
                val travel = 14.dp.toPx()
                drawCircle(colors.surface, radius, Offset(3.dp.toPx() + radius + travel * p, size.height / 2))
            },
    )
}
