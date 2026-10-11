package com.jcsoftdev.ui.sample

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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
import com.jcsoftdev.ui.theme.UiStrings
import com.jcsoftdev.ui.theme.UiTheme

private val Options = listOf(RadioOption("a", "Efectivo", "Pago en caja"), RadioOption("b", "Tarjeta"), RadioOption("c", "Yape"))

@Composable
fun AtomsGallery() {
    Column(Modifier.statusBarsPadding().verticalScroll(rememberScrollState())) {
        Panel(dark = false)
        Panel(dark = true)
    }
}

@Composable
private fun Panel(dark: Boolean) {
    UiTheme(dark = dark, accent = "#77D3AD", strings = UiStrings.Es) {
        var on by remember { mutableStateOf(true) }
        var box by remember { mutableStateOf(ToggleableState.Indeterminate) }
        var radio by remember { mutableStateOf<String?>("a") }
        Column(Modifier.background(UiTheme.colors.bg).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(if (dark) "Dark" else "Light", style = UiTheme.typography.pageTitle)
            Text("Body text in the theme font", style = UiTheme.typography.body)
            Text("Meta text, ink3", style = UiTheme.typography.meta, color = UiTheme.colors.ink3)
            Divider()
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                ButtonVariant.entries.forEach { Button(it.name, {}, variant = it) }
                Button("Small", {}, size = ButtonSize.Sm)
                Button("Loading", {}, variant = ButtonVariant.Primary, loading = true)
                Button("Disabled", {}, variant = ButtonVariant.Primary, enabled = false)
                IconButton({}, "Add") { Text("+") }
            }
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                ChipTone.entries.forEach { Chip(it.name, tone = it) }
                Chip("Square", square = true)
                StatusPill(LedStatus.Success, "Online")
                StatusPill(LedStatus.Danger, "Offline", onSelect = {})
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Avatar("Juan Carlos")
                Avatar("Maria Perez", size = AvatarSize.Lg, highlighted = true)
                Switch(on, { on = it }, contentDescription = "Notifications")
                Switch(false, {}, enabled = false)
                Checkbox(box, {
                    box =
                        if (box ==
                            ToggleableState.On
                        ) {
                            ToggleableState.Off
                        } else {
                            ToggleableState.On
                        }
                }, contentDescription = "All")
                Checkbox(true, {}, enabled = false)
            }
            Progress(62f)
            Progress()
            RadioGroup(Options, radio, { radio = it })
        }
    }
}
