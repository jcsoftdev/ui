package com.jcsoftdev.ui.screenshots

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.state.ToggleableState
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.atoms.Avatar
import com.jcsoftdev.ui.atoms.AvatarSize
import com.jcsoftdev.ui.atoms.Button
import com.jcsoftdev.ui.atoms.ButtonSize
import com.jcsoftdev.ui.atoms.ButtonVariant
import com.jcsoftdev.ui.atoms.Checkbox
import com.jcsoftdev.ui.atoms.Chip
import com.jcsoftdev.ui.atoms.ChipTone
import com.jcsoftdev.ui.atoms.Divider
import com.jcsoftdev.ui.atoms.IconButton
import com.jcsoftdev.ui.atoms.LedStatus
import com.jcsoftdev.ui.atoms.Progress
import com.jcsoftdev.ui.atoms.RadioGroup
import com.jcsoftdev.ui.atoms.RadioOption
import com.jcsoftdev.ui.atoms.StatusPill
import com.jcsoftdev.ui.atoms.Switch
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.atoms.VerticalDivider
import com.jcsoftdev.ui.icons.Calendar
import com.jcsoftdev.ui.icons.Icon
import com.jcsoftdev.ui.icons.Icons
import com.jcsoftdev.ui.icons.Plus
import com.jcsoftdev.ui.theme.UiTheme
import kotlin.test.Test

class AtomsShots {
    private val pad = Modifier.padding(12.dp)
    private val gap = Arrangement.spacedBy(8.dp)

    @Test fun text() =
        shoot("atoms", "text") {
            Column(pad, gap) {
                Text("Page title", style = UiTheme.typography.pageTitle)
                Text("Body text in the theme font that is long enough to wrap onto a second line.", style = UiTheme.typography.body)
                Text("Meta text in ink3", style = UiTheme.typography.meta, color = UiTheme.colors.ink3)
            }
        }

    @Test fun buttonVariants() =
        shoot("atoms", "button-variants") {
            FlowRow(pad, gap, gap) { ButtonVariant.entries.forEach { Button(it.name, {}, variant = it) } }
        }

    @Test fun buttonStates() =
        shoot("atoms", "button-states") {
            FlowRow(pad, gap, gap) {
                Button("Small", {}, size = ButtonSize.Sm)
                Button("Large", {}, size = ButtonSize.Lg)
                Button("Loading", {}, variant = ButtonVariant.Primary, loading = true)
                Button("Disabled", {}, variant = ButtonVariant.Primary, enabled = false)
                Button("Block", {}, variant = ButtonVariant.Primary, block = true)
            }
        }

    @Test fun iconButton() =
        shoot("atoms", "icon-button") {
            Row(pad, gap) {
                IconButton({}, "Add") { Icon(Icons.Plus, contentDescription = null) }
                IconButton({}, "Calendar", enabled = false) { Icon(Icons.Calendar, contentDescription = null) }
            }
        }

    @Test fun chips() =
        shoot("atoms", "chips") {
            FlowRow(pad, gap, gap) {
                ChipTone.entries.forEach { Chip(it.name, tone = it) }
                Chip("Square", square = true)
            }
        }

    @Test fun statusPills() =
        shoot("atoms", "status-pills") {
            FlowRow(pad, gap, gap) {
                LedStatus.entries.forEach { StatusPill(it, it.name) }
                StatusPill(LedStatus.Danger, "Selectable", onSelect = {})
            }
        }

    @Test fun avatars() =
        shoot("atoms", "avatars") {
            Row(pad, gap, Alignment.CenterVertically) {
                Avatar("Juan Carlos")
                Avatar("Maria Perez", size = AvatarSize.Lg)
                Avatar("Ana Ruiz", size = AvatarSize.Lg, highlighted = true)
            }
        }

    @Test fun progress() =
        shoot("atoms", "progress") {
            Column(pad, gap) {
                Progress(0f)
                Progress(62f)
                Progress(100f)
                Progress()
            }
        }

    @Test fun switches() =
        shoot("atoms", "switches") {
            Row(pad, gap, Alignment.CenterVertically) {
                Switch(true, {}, contentDescription = "On")
                Switch(false, {}, contentDescription = "Off")
                Switch(true, {}, enabled = false, contentDescription = "Disabled on")
                Switch(false, {}, enabled = false, contentDescription = "Disabled off")
            }
        }

    @Test fun checkboxes() =
        shoot("atoms", "checkboxes") {
            Row(pad, gap, Alignment.CenterVertically) {
                Checkbox(ToggleableState.On, {}, contentDescription = "On")
                Checkbox(ToggleableState.Off, {}, contentDescription = "Off")
                Checkbox(ToggleableState.Indeterminate, {}, contentDescription = "Some")
                Checkbox(true, {}, enabled = false, contentDescription = "Disabled")
            }
        }

    @Test fun radioGroup() =
        shoot("atoms", "radio-group") {
            RadioGroup(
                listOf(RadioOption("a", "Efectivo", "Pago en caja"), RadioOption("b", "Tarjeta"), RadioOption("c", "Yape")),
                "a",
                {},
                pad,
            )
        }

    @Test fun dividers() =
        shoot("atoms", "dividers") {
            Column(pad, gap) {
                Text("Above")
                Divider()
                Row(Modifier.fillMaxWidth().height(32.dp), gap, Alignment.CenterVertically) {
                    Text("Left")
                    VerticalDivider()
                    Text("Right")
                }
            }
        }
}
