package com.jcsoftdev.ui.atoms

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.triStateToggleable
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.state.ToggleableState
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.foundation.Motion
import com.jcsoftdev.ui.theme.UiTheme

/** Two-state checkbox; see the [ToggleableState] overload for the indeterminate state. */
@Composable
public fun Checkbox(
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    contentDescription: String? = null,
) {
    Checkbox(
        state = if (checked) ToggleableState.On else ToggleableState.Off,
        onClick = { onCheckedChange(!checked) },
        modifier = modifier,
        enabled = enabled,
        contentDescription = contentDescription,
    )
}

/** Tri-state checkbox: a round 18dp mark inside a 48dp touch target, filled in the success color when On or Indeterminate. */
@Composable
public fun Checkbox(
    state: ToggleableState,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    contentDescription: String? = null,
) {
    val colors = UiTheme.colors
    val source = remember { MutableInteractionSource() }
    val progress = animateFloatAsState(if (state == ToggleableState.Off) 0f else 1f, UiTheme.motion.tween(Motion.FAST), label = "checkbox")
    Box(
        modifier
            .triStateToggleable(state, source, null, enabled, Role.Checkbox, onClick)
            .minimumTouchTarget()
            .semantics { if (contentDescription != null) this.contentDescription = contentDescription }
            .graphicsLayer { alpha = if (enabled) 1f else DISABLED_ALPHA }
            .size(18.dp)
            .drawBehind {
                val p = progress.value
                val stroke = 1.5.dp.toPx()
                drawCircle(lerp(colors.lineStrong, colors.success, p), size.minDimension / 2 - stroke / 2, style = Stroke(stroke))
                drawCircle(colors.success.copy(alpha = p), size.minDimension / 2 - stroke / 2)
                val glyph = colors.onAccent.copy(alpha = p)
                if (state == ToggleableState.Indeterminate) drawMinusGlyph(glyph, 2.dp.toPx()) else drawCheckGlyph(glyph, 2.dp.toPx())
            },
    )
}
