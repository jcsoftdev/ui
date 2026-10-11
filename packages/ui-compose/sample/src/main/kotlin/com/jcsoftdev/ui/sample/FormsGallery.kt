package com.jcsoftdev.ui.sample

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.forms.DateInput
import com.jcsoftdev.ui.forms.Field
import com.jcsoftdev.ui.forms.Input
import com.jcsoftdev.ui.forms.NumberStepper
import com.jcsoftdev.ui.forms.PasswordInput
import com.jcsoftdev.ui.forms.PinInput
import com.jcsoftdev.ui.forms.Select
import com.jcsoftdev.ui.forms.SelectOption
import com.jcsoftdev.ui.forms.TimeInput
import com.jcsoftdev.ui.navigation.Segmented
import com.jcsoftdev.ui.navigation.SegmentedOption
import com.jcsoftdev.ui.navigation.TabItem
import com.jcsoftdev.ui.navigation.Tabs
import com.jcsoftdev.ui.theme.UiStrings
import com.jcsoftdev.ui.theme.UiTheme

private val Branches = listOf(SelectOption("a", "Miraflores"), SelectOption("b", "San Isidro"), SelectOption("c", "Surco"))
private val Modes = listOf(SegmentedOption("day", "Día"), SegmentedOption("week", "Semana"), SegmentedOption("month", "Mes"))
private val Sections = listOf(TabItem("a", "Citas", 3), TabItem("b", "Clientes"), TabItem("c", "Stock", 12))

@Composable
fun FormsGallery() {
    UiTheme(dark = false, accent = "#77D3AD", strings = UiStrings.Es) {
        var name by remember { mutableStateOf("") }
        var password by remember { mutableStateOf("") }
        var time by remember { mutableStateOf("") }
        var date by remember { mutableStateOf("") }
        var pin by remember { mutableStateOf("") }
        var qty by remember { mutableIntStateOf(2) }
        var branch by remember { mutableStateOf<String?>(null) }
        var mode by remember { mutableStateOf<String?>("week") }
        var tab by remember { mutableStateOf("a") }
        Column(
            Modifier
                .background(UiTheme.colors.bg)
                .statusBarsPadding()
                .imePadding()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Text("Forms", style = UiTheme.typography.pageTitle)
            Tabs(Sections, tab, { tab = it }, Modifier.fillMaxWidth())
            Field("Nombre", required = true, error = if (name.isBlank()) "Obligatorio" else null) {
                Input(name, { name = it }, placeholder = "Juan Carlos")
            }
            Field("Contraseña") { PasswordInput(password, { password = it }) }
            Field("Apertura", description = "Teclado numérico, los dos puntos se agregan solos", optionalLabel = "opcional") {
                TimeInput(time, { time = it }, placeholder = "HH:mm")
            }
            Field("Vencimiento") { DateInput(date, { date = it }, placeholder = "dd/MM/yyyy") }
            Field("Sede") { Select(Branches, branch, { branch = it }, placeholder = "Elegir sede") }
            Field("Código") { PinInput(pin, { pin = it }, contentDescription = "Código de verificación") }
            Field("Cantidad") { NumberStepper(qty, { qty = it }, max = 10) }
            Segmented(Modes, mode, { mode = it })
            Text("time=$time date=$date pin=$pin", style = UiTheme.typography.meta, color = UiTheme.colors.ink3)
        }
    }
}
