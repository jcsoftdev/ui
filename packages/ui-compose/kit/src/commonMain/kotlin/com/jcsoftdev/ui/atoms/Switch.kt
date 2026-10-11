package com.jcsoftdev.ui.atoms

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.toggleable
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.foundation.Motion
import com.jcsoftdev.ui.theme.UiTheme

/** Colors of a [Switch]: track off and on, and the thumb. */
@Immutable
public class SwitchColors(
    public val trackOff: Color,
    public val trackOn: Color,
    public val thumb: Color,
) {
    /** Copy with selected colors replaced. */
    public fun copy(
        trackOff: Color = this.trackOff,
        trackOn: Color = this.trackOn,
        thumb: Color = this.thumb,
    ): SwitchColors = SwitchColors(trackOff, trackOn, thumb)
}

/** Default colors and size of [Switch]. */
public object SwitchDefaults {
    /** Colors in the active theme. */
    @Composable
    @ReadOnlyComposable
    public fun colors(): SwitchColors {
        val c = UiTheme.colors
        return SwitchColors(c.lineStrong, c.accent, c.surface)
    }

    /** Track size; the thumb is the track height minus a 3dp inset on each side. */
    public val trackSize: DpSize = DpSize(34.dp, 20.dp)

    /** Gap between the thumb and the track edge. */
    public val thumbInset: Dp = 3.dp
}

/** Controlled on/off switch; 34x20dp visual by default inside a 48dp touch target. [contentDescription] names it for screen readers. */
@Composable
public fun Switch(
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    contentDescription: String? = null,
    colors: SwitchColors = SwitchDefaults.colors(),
    trackSize: DpSize = SwitchDefaults.trackSize,
    thumbInset: Dp = SwitchDefaults.thumbInset,
) {
    val source = remember { MutableInteractionSource() }
    val progress = animateFloatAsState(if (checked) 1f else 0f, UiTheme.motion.tween(Motion.STANDARD), label = "switch")
    Box(
        modifier
            .toggleable(checked, source, null, enabled, Role.Switch, onCheckedChange)
            .minimumTouchTarget()
            .semantics { if (contentDescription != null) this.contentDescription = contentDescription }
            .dimWhenDisabled(enabled)
            .size(trackSize)
            .drawBehind {
                val p = progress.value
                drawRoundRect(lerp(colors.trackOff, colors.trackOn, p), cornerRadius = CornerRadius(size.height / 2))
                val inset = thumbInset.toPx()
                val radius = size.height / 2 - inset
                val travel = size.width - 2 * inset - 2 * radius
                drawCircle(colors.thumb, radius, Offset(inset + radius + travel * p, size.height / 2))
            },
    )
}
