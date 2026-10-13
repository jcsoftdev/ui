package com.jcsoftdev.ui.sample

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.focusable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.setProgress
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.navigation.Segmented
import com.jcsoftdev.ui.navigation.SegmentedOption
import com.jcsoftdev.ui.theme.UiTheme
import kotlin.math.roundToInt

/** A heading that groups related controls. */
@Composable
fun ControlSection(title: String) {
    Text(
        title.uppercase(),
        Modifier.fillMaxWidth().padding(top = 18.dp, bottom = 2.dp).semantics { heading() },
        style = UiTheme.typography.overline,
        color = UiTheme.colors.ink2,
    )
}

/**
 * A labeled slider with its current value next to the label. Built on foundation gestures so it works the same on touch and
 * pointer input; it exposes slider semantics (range, state, set-progress action) and answers the arrow keys.
 *
 * @param label name of the parameter, also the accessibility label.
 * @param display the value as the user reads it ("1.20", "22 dp").
 * @param step smallest change; values snap to it.
 * @param trailing extra control on the label row, such as an "Auto" toggle.
 */
@Composable
fun LabSlider(
    label: String,
    value: Float,
    onValueChange: (Float) -> Unit,
    range: ClosedFloatingPointRange<Float>,
    step: Float,
    display: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    trailing: (@Composable () -> Unit)? = null,
) {
    val colors = UiTheme.colors
    var width by remember { mutableIntStateOf(1) }
    val change by rememberUpdatedState(onValueChange)
    val span = range.endInclusive - range.start

    fun snap(raw: Float): Float {
        val stepped = range.start + ((raw - range.start) / step).roundToInt() * step
        return (stepped.coerceIn(range.start, range.endInclusive) * 1000f).roundToInt() / 1000f
    }

    fun at(x: Float): Float = snap(range.start + (x / width).coerceIn(0f, 1f) * span)
    val shown = value.coerceIn(range.start, range.endInclusive)
    val steps = (span / step).roundToInt().minus(1).coerceAtLeast(0)
    Column(modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                label,
                Modifier.clearAndSetSemantics {},
                style = UiTheme.typography.meta,
                color = if (enabled) colors.ink else colors.ink3,
            )
            Spacer(Modifier.weight(1f))
            Text(display, Modifier.clearAndSetSemantics {}, style = UiTheme.typography.data, color = colors.ink2)
            if (trailing != null) {
                Spacer(Modifier.width(8.dp))
                trailing()
            }
        }
        Box(
            Modifier
                .fillMaxWidth()
                .height(36.dp)
                .onSizeChanged { width = it.width.coerceAtLeast(1) }
                .semantics {
                    contentDescription = label
                    stateDescription = display
                    progressBarRangeInfo = ProgressBarRangeInfo(shown, range, steps)
                    setProgress { target ->
                        if (enabled) change(snap(target))
                        enabled
                    }
                }.focusable(enabled)
                .onPreviewKeyEvent { event ->
                    if (!enabled || event.type != KeyEventType.KeyDown) return@onPreviewKeyEvent false
                    when (event.key) {
                        Key.DirectionLeft, Key.DirectionDown -> change(snap(shown - step))
                        Key.DirectionRight, Key.DirectionUp -> change(snap(shown + step))
                        else -> return@onPreviewKeyEvent false
                    }
                    true
                }.pointerInput(enabled, range, step) {
                    if (enabled) detectTapGestures { change(at(it.x)) }
                }.pointerInput(enabled, range, step) {
                    if (enabled) {
                        detectHorizontalDragGestures(onDragStart = { change(at(it.x)) }) { pointer, _ ->
                            pointer.consume()
                            change(at(pointer.position.x))
                        }
                    }
                },
        ) {
            val track = if (enabled) colors.track else colors.line
            val active = if (enabled) colors.accent else colors.ink3
            Canvas(Modifier.fillMaxWidth().height(36.dp)) {
                val pad = 10.dp.toPx()
                val y = size.height / 2
                val x = pad + (size.width - 2 * pad) * ((shown - range.start) / span)
                drawLine(track, Offset(pad, y), Offset(size.width - pad, y), 4.dp.toPx(), StrokeCap.Round)
                drawLine(active, Offset(pad, y), Offset(x, y), 4.dp.toPx(), StrokeCap.Round)
                drawCircle(Color.Black.copy(alpha = 0.18f), 11.dp.toPx(), Offset(x, y + 1.dp.toPx()))
                drawCircle(Color.White, 10.dp.toPx(), Offset(x, y))
                drawCircle(
                    active,
                    10.dp.toPx(),
                    Offset(x, y),
                    style =
                        androidx.compose.ui.graphics.drawscope
                            .Stroke(2.dp.toPx()),
                )
            }
        }
    }
}

/** A small text toggle that returns an optional value to "follow the material" ("Auto"). */
@Composable
fun AutoToggle(
    label: String,
    auto: Boolean,
    onChange: (Boolean) -> Unit,
) {
    val c = UiTheme.colors
    Box(
        Modifier
            .clip(CircleShape)
            .border(1.dp, if (auto) c.accentLine else c.lineControl, CircleShape)
            .selectable(auto, role = Role.Switch, onClick = { onChange(!auto) })
            .semantics { contentDescription = label }
            .padding(horizontal = 10.dp, vertical = 4.dp),
    ) {
        Text("Auto", style = UiTheme.typography.chipText, color = if (auto) c.accentInk else c.ink2)
    }
}

/** A row of mutually exclusive options. */
@Composable
fun <T> ChoiceRow(
    label: String,
    options: List<Pair<String, T>>,
    selected: T,
    onSelect: (T) -> Unit,
) {
    Column(Modifier.fillMaxWidth().padding(top = 6.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(label, Modifier.clearAndSetSemantics {}, style = UiTheme.typography.meta)
        val values = options.map { it.second }
        Segmented(
            options.mapIndexed { i, (name, _) -> SegmentedOption(i.toString(), name) },
            values.indexOf(selected).toString(),
            { onSelect(values[it.toInt()]) },
            Modifier.fillMaxWidth().semantics { contentDescription = label },
        )
    }
}

/** A tint swatch: the color, or [Color.Unspecified] for "none" (the material's own tint). */
class TintChoice(
    val name: String,
    val color: Color,
)

val TintChoices: List<TintChoice> =
    listOf(
        TintChoice("Material tint", Color.Unspecified),
        TintChoice("Rose", Color(0xFFFF6B8B)),
        TintChoice("Amber", Color(0xFFFFB347)),
        TintChoice("Mint", Color(0xFF4FD1A5)),
        TintChoice("Sky", Color(0xFF4DA3FF)),
        TintChoice("Violet", Color(0xFF9B6BFF)),
    )

@Composable
fun TintSwatches(
    selected: Color,
    onSelect: (Color) -> Unit,
) {
    val c = UiTheme.colors
    Column(Modifier.fillMaxWidth().padding(top = 6.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text("Tint color", Modifier.clearAndSetSemantics {}, style = UiTheme.typography.meta)
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            for (choice in TintChoices) {
                val on = choice.color == selected
                Box(
                    Modifier
                        .size(44.dp)
                        .selectable(on, role = Role.RadioButton, onClick = { onSelect(choice.color) })
                        .semantics { contentDescription = "Tint color: ${choice.name}" },
                    contentAlignment = Alignment.Center,
                ) {
                    Box(
                        Modifier
                            .size(30.dp)
                            .clip(CircleShape)
                            .border(if (on) 3.dp else 1.dp, if (on) c.accent else c.lineControl, CircleShape)
                            .padding(if (on) 3.dp else 0.dp)
                            .clip(CircleShape)
                            .then(
                                if (choice.color == Color.Unspecified) {
                                    Modifier.border(1.dp, c.ink3, CircleShape)
                                } else {
                                    Modifier.background(choice.color)
                                },
                            ),
                    )
                }
            }
        }
    }
}
