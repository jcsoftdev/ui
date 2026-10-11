package com.jcsoftdev.ui.atoms

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.triStateToggleable
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.state.ToggleableState
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.foundation.Motion
import com.jcsoftdev.ui.theme.UiTheme

/** Colors of a [Checkbox]: unchecked ring, checked fill and the check mark. */
@Immutable
public class CheckboxColors(
    public val border: Color,
    public val checked: Color,
    public val mark: Color,
) {
    /** Copy with selected colors replaced. */
    public fun copy(
        border: Color = this.border,
        checked: Color = this.checked,
        mark: Color = this.mark,
    ): CheckboxColors = CheckboxColors(border, checked, mark)
}

/** Default colors and size of [Checkbox]. */
public object CheckboxDefaults {
    /** Colors in the active theme; checked is the success color. */
    @Composable
    @ReadOnlyComposable
    public fun colors(): CheckboxColors {
        val c = UiTheme.colors
        return CheckboxColors(c.lineStrong, c.success, c.onAccent)
    }

    /** Diameter of the mark inside the touch target. */
    public val size: Dp = 18.dp
}

/** Two-state checkbox; see the [ToggleableState] overload for the indeterminate state. */
@Composable
public fun Checkbox(
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    contentDescription: String? = null,
    colors: CheckboxColors = CheckboxDefaults.colors(),
    diameter: Dp = CheckboxDefaults.size,
) {
    Checkbox(
        state = if (checked) ToggleableState.On else ToggleableState.Off,
        onClick = { onCheckedChange(!checked) },
        modifier = modifier,
        enabled = enabled,
        contentDescription = contentDescription,
        colors = colors,
        diameter = diameter,
    )
}

/** Tri-state checkbox: a round mark (18dp by default) inside a 48dp touch target, filled in the success color when On or Indeterminate. */
@Composable
public fun Checkbox(
    state: ToggleableState,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    contentDescription: String? = null,
    colors: CheckboxColors = CheckboxDefaults.colors(),
    diameter: Dp = CheckboxDefaults.size,
) {
    val source = remember { MutableInteractionSource() }
    val progress = animateFloatAsState(if (state == ToggleableState.Off) 0f else 1f, UiTheme.motion.tween(Motion.FAST), label = "checkbox")
    Box(
        modifier
            .triStateToggleable(state, source, null, enabled, Role.Checkbox, onClick)
            .minimumTouchTarget()
            .semantics { if (contentDescription != null) this.contentDescription = contentDescription }
            .dimWhenDisabled(enabled)
            .size(diameter)
            .drawBehind {
                val p = progress.value
                val stroke = 1.5.dp.toPx()
                drawCircle(lerp(colors.border, colors.checked, p), size.minDimension / 2 - stroke / 2, style = Stroke(stroke))
                drawCircle(colors.checked.copy(alpha = p), size.minDimension / 2 - stroke / 2)
                val glyph = colors.mark.copy(alpha = p)
                if (state == ToggleableState.Indeterminate) drawMinusGlyph(glyph, 2.dp.toPx()) else drawCheckGlyph(glyph, 2.dp.toPx())
            },
    )
}
