package com.jcsoftdev.ui.forms

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selectableGroup
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupProperties
import com.jcsoftdev.ui.atoms.DISABLED_ALPHA
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.foundation.BackHandler
import com.jcsoftdev.ui.foundation.BackPriority
import com.jcsoftdev.ui.theme.UiShapes
import com.jcsoftdev.ui.theme.UiTheme
import com.jcsoftdev.ui.theme.UiTypography

@Immutable
public class SelectOption(
    public val value: String,
    public val label: String,
)

/**
 * Single choice from a list. The list opens in an anchored popup below the field (system back closes it through the
 * kit back dispatcher). C7 swaps this popup for the kit Sheet; the parameters will not change.
 */
@Composable
public fun Select(
    options: List<SelectOption>,
    value: String?,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    isError: Boolean = false,
    placeholder: String? = null,
    contentDescription: String? = null,
) {
    val colors = UiTheme.colors
    val info = LocalFieldInfo.current
    var expanded by remember { mutableStateOf(false) }
    var triggerWidth by remember { mutableIntStateOf(0) }
    var triggerHeight by remember { mutableIntStateOf(0) }
    val selected = options.firstOrNull { it.value == value }
    val hasError = isError || info?.error != null
    val spoken = contentDescription ?: info?.spoken
    BackHandler(enabled = expanded, priority = BackPriority.OVERLAY) { expanded = false }
    Box(modifier) {
        Row(
            Modifier
                .onSizeChanged {
                    triggerWidth = it.width
                    triggerHeight = it.height
                }.graphicsLayer { alpha = if (enabled) 1f else DISABLED_ALPHA }
                .heightIn(min = 48.dp)
                .clip(UiShapes.control)
                .clickable(enabled = enabled, role = Role.DropdownList) { expanded = true }
                .background(colors.surface)
                .border(
                    if (hasError) 2.dp else 1.dp,
                    if (hasError) {
                        colors.danger
                    } else if (expanded) {
                        colors.accent
                    } else {
                        colors.lineControl
                    },
                    UiShapes.control,
                ).semantics {
                    if (spoken != null) this.contentDescription = spoken
                    stateDescription = selected?.label ?: placeholder.orEmpty()
                }.padding(horizontal = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                selected?.label ?: placeholder.orEmpty(),
                modifier = Modifier.weight(1f),
                color = if (selected == null) colors.ink3 else colors.ink,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Chevron(expanded)
        }
        if (expanded) {
            val widthDp = with(LocalDensity.current) { triggerWidth.toDp() }
            Popup(
                offset = IntOffset(0, triggerHeight),
                onDismissRequest = { expanded = false },
                properties = PopupProperties(focusable = true),
            ) {
                Column(
                    Modifier
                        .width(widthDp)
                        .heightIn(max = 280.dp)
                        .clip(UiShapes.control)
                        .background(colors.float)
                        .border(1.dp, colors.hair, UiShapes.control)
                        .verticalScroll(rememberScrollState())
                        .selectableGroup(),
                ) {
                    options.forEach { option ->
                        val isSelected = option.value == value
                        Box(
                            Modifier
                                .selectable(isSelected, role = Role.RadioButton) {
                                    onValueChange(option.value)
                                    expanded = false
                                }.heightIn(min = 48.dp)
                                .padding(horizontal = 12.dp),
                            contentAlignment = Alignment.CenterStart,
                        ) {
                            Text(
                                option.label,
                                style = UiTypography.body.copy(fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal),
                                color = if (isSelected) colors.accentInk else colors.ink,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun Chevron(open: Boolean) {
    val color = UiTheme.colors.ink3
    Box(
        Modifier.size(16.dp).graphicsLayer { rotationZ = if (open) 180f else 0f }.drawBehind {
            val path =
                Path().apply {
                    moveTo(size.width * 0.25f, size.height * 0.4f)
                    lineTo(size.width * 0.5f, size.height * 0.65f)
                    lineTo(size.width * 0.75f, size.height * 0.4f)
                }
            drawPath(path, color, style = Stroke(1.6.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round))
        },
    )
}
