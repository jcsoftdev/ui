package com.jcsoftdev.ui.atoms

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.theme.ThemeColors
import com.jcsoftdev.ui.theme.UiShapes
import com.jcsoftdev.ui.theme.UiSizes
import com.jcsoftdev.ui.theme.UiTheme
import com.jcsoftdev.ui.theme.UiTypography

public enum class ChipTone { Neutral, Info, Danger, Warning, Success, Accent, Solid, Outline }

public enum class LedStatus { Success, Warning, Danger, Idle }

private fun ChipTone.container(c: ThemeColors): Color =
    when (this) {
        ChipTone.Neutral -> c.surface2
        ChipTone.Info -> c.infoSoft
        ChipTone.Danger -> c.dangerSoft
        ChipTone.Warning -> c.warningSoft
        ChipTone.Success -> c.successSoft
        ChipTone.Accent -> c.accentSoft
        ChipTone.Solid -> c.accent
        ChipTone.Outline -> Color.Transparent
    }

private fun ChipTone.content(c: ThemeColors): Color =
    when (this) {
        ChipTone.Neutral, ChipTone.Outline -> c.ink2
        ChipTone.Info -> c.info
        ChipTone.Danger -> c.danger
        ChipTone.Warning -> c.warning
        ChipTone.Success -> c.success
        ChipTone.Accent -> c.accentInk
        ChipTone.Solid -> c.onAccent
    }

/** Static label chip. [square] uses the small chip radius instead of a full pill. */
@Composable
public fun Chip(
    text: String,
    modifier: Modifier = Modifier,
    tone: ChipTone = ChipTone.Neutral,
    square: Boolean = false,
    leading: (@Composable () -> Unit)? = null,
    trailing: (@Composable () -> Unit)? = null,
) {
    val colors = UiTheme.colors
    val shape = if (square) UiShapes.chip else UiShapes.pill
    Row(
        modifier =
            modifier
                .clip(shape)
                .background(tone.container(colors))
                .then(if (tone == ChipTone.Outline) Modifier.border(1.dp, colors.lineStrong, shape) else Modifier)
                .defaultMinSize(minHeight = 24.dp)
                .padding(horizontal = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        CompositionLocalProvider(LocalContentColor provides tone.content(colors)) {
            leading?.invoke()
            Text(text, Modifier.weight(1f, fill = false), UiTypography.chipText, maxLines = 1, overflow = TextOverflow.Ellipsis)
            trailing?.invoke()
        }
    }
}

private fun LedStatus.color(c: ThemeColors): Color =
    when (this) {
        LedStatus.Success -> c.success
        LedStatus.Warning -> c.warning
        LedStatus.Danger -> c.danger
        LedStatus.Idle -> c.ink3
    }

/** Pill with a status dot and its label. Without [onSelect] it is decorative and not focusable. */
@Composable
public fun StatusPill(
    status: LedStatus,
    label: String,
    modifier: Modifier = Modifier,
    onSelect: (() -> Unit)? = null,
) {
    val colors = UiTheme.colors
    val source = remember { MutableInteractionSource() }
    Row(
        modifier =
            modifier
                .then(if (onSelect != null) Modifier.pressableTarget(onSelect, true, Role.Button, source) else Modifier)
                .clip(UiShapes.pill)
                .background(colors.surface)
                .border(1.dp, colors.hair, UiShapes.pill)
                .defaultMinSize(minHeight = UiSizes.controlHeightSm)
                .padding(horizontal = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(7.dp).background(status.color(colors), CircleShape))
        Text(label, style = UiTypography.chipText, color = colors.ink2, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}
