package com.jcsoftdev.ui.forms

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.atoms.ButtonColors
import com.jcsoftdev.ui.atoms.ButtonDefaults
import com.jcsoftdev.ui.atoms.ButtonVariant
import com.jcsoftdev.ui.atoms.IconButton
import com.jcsoftdev.ui.atoms.LocalContentColor
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.theme.UiTheme

/** Default colors and metrics of [NumberStepper]. */
public object NumberStepperDefaults {
    /** Colors of the two buttons; the secondary button variant. */
    @Composable
    @ReadOnlyComposable
    public fun buttonColors(): ButtonColors = ButtonDefaults.colors(ButtonVariant.Secondary)

    /** Style of the value; the theme `rowTitle`, bold. */
    public val valueStyle: TextStyle
        @Composable @ReadOnlyComposable
        get() = UiTheme.typography.rowTitle.copy(fontWeight = FontWeight.Bold)

    /** Minimum width of the value so the buttons do not jump. */
    public val valueMinWidth: Dp = 40.dp

    /** Gap between the buttons and the value. */
    public val spacing: Dp = 4.dp

    /** The minus (`plus` false) and plus glyphs of the buttons, drawn in the button content color; [NumberStepper]'s `stepIcon` replaces them. */
    public val StepIcon: @Composable (plus: Boolean) -> Unit = { plus -> StepGlyph(plus) }
}

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
    buttonColors: ButtonColors = NumberStepperDefaults.buttonColors(),
    valueStyle: TextStyle = NumberStepperDefaults.valueStyle,
    valueColor: Color = Color.Unspecified,
    buttonShape: Shape = ButtonDefaults.shape,
    stepIcon: @Composable (plus: Boolean) -> Unit = NumberStepperDefaults.StepIcon,
) {
    Row(
        modifier,
        horizontalArrangement = Arrangement.spacedBy(NumberStepperDefaults.spacing),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        IconButton(
            { onValueChange((value - step).coerceAtLeast(min)) },
            decrementDescription,
            colors = buttonColors,
            shape = buttonShape,
            enabled = enabled && value > min,
        ) { stepIcon(false) }
        Text(
            value.toString(),
            modifier = Modifier.widthIn(min = NumberStepperDefaults.valueMinWidth).semantics { liveRegion = LiveRegionMode.Polite },
            style = valueStyle,
            color = valueColor,
            textAlign = TextAlign.Center,
        )
        IconButton(
            { onValueChange((value + step).coerceAtMost(max)) },
            incrementDescription,
            colors = buttonColors,
            shape = buttonShape,
            enabled = enabled && value < max,
        ) { stepIcon(true) }
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
