package com.jcsoftdev.ui.forms

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.atoms.ButtonVariant
import com.jcsoftdev.ui.atoms.IconButton
import com.jcsoftdev.ui.atoms.LocalContentColor
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.theme.UiTypography

/** Integer stepper clamped to [min]..[max]; the buttons disable at the limits and need descriptions because they are icon-only. */
@Composable
public fun NumberStepper(
    value: Int,
    onValueChange: (Int) -> Unit,
    decrementDescription: String,
    incrementDescription: String,
    modifier: Modifier = Modifier,
    min: Int = 0,
    max: Int = Int.MAX_VALUE,
    step: Int = 1,
    enabled: Boolean = true,
) {
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
        IconButton(
            { onValueChange((value - step).coerceAtLeast(min)) },
            decrementDescription,
            variant = ButtonVariant.Secondary,
            enabled = enabled && value > min,
        ) { StepGlyph(plus = false) }
        Text(
            value.toString(),
            modifier = Modifier.widthIn(min = 40.dp).semantics { liveRegion = LiveRegionMode.Polite },
            style = UiTypography.rowTitle.copy(fontWeight = FontWeight.Bold),
            textAlign = TextAlign.Center,
        )
        IconButton(
            { onValueChange((value + step).coerceAtMost(max)) },
            incrementDescription,
            variant = ButtonVariant.Secondary,
            enabled = enabled && value < max,
        ) { StepGlyph(plus = true) }
    }
}

@Composable
private fun StepGlyph(plus: Boolean) {
    val color = LocalContentColor.current
    Box(
        remember(plus) {
            Modifier.size(16.dp).drawBehind {
                val stroke = 1.8.dp.toPx()
                val mid = size.width / 2
                val reach = size.width * 0.35f
                drawLine(color, Offset(mid - reach, mid), Offset(mid + reach, mid), stroke, StrokeCap.Round)
                if (plus) drawLine(color, Offset(mid, mid - reach), Offset(mid, mid + reach), stroke, StrokeCap.Round)
            }
        },
    )
}
