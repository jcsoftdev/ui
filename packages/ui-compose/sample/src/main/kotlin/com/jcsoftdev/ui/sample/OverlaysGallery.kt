package com.jcsoftdev.ui.sample

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.atoms.Button
import com.jcsoftdev.ui.atoms.ButtonSize
import com.jcsoftdev.ui.atoms.ButtonVariant
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.forms.Field
import com.jcsoftdev.ui.forms.Input
import com.jcsoftdev.ui.forms.Select
import com.jcsoftdev.ui.forms.SelectOption
import com.jcsoftdev.ui.overlays.Dialog
import com.jcsoftdev.ui.overlays.Menu
import com.jcsoftdev.ui.overlays.Sheet
import com.jcsoftdev.ui.overlays.Toaster
import com.jcsoftdev.ui.primitives.ToastAction
import com.jcsoftdev.ui.primitives.ToastHostState
import com.jcsoftdev.ui.theme.UiTheme

private val Barbers = List(12) { SelectOption("b$it", "Barbero ${it + 1}") }

@Composable
fun OverlaysGallery() {
    UiTheme(dark = false, accent = "#77D3AD") {
        val toasts = remember { ToastHostState() }
        var sheet by remember { mutableStateOf(false) }
        var dialog by remember { mutableStateOf(false) }
        var menu by remember { mutableStateOf(false) }
        var sort by remember { mutableStateOf("name") }
        var barber by remember { mutableStateOf<String?>(null) }
        Box(Modifier.fillMaxSize().background(UiTheme.colors.bg)) {
            Column(
                Modifier.statusBarsPadding().verticalScroll(rememberScrollState()).padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text("Overlays")
                Button("Hoja con lista larga", { sheet = true }, block = true, size = ButtonSize.Lg, variant = ButtonVariant.Primary)
                Button("Diálogo de confirmación", { dialog = true }, block = true)
                Button("Toast", { toasts.success("Cita guardada") }, block = true)
                Button(
                    "Toast con acción",
                    { toasts.info("Cita cancelada", ToastAction("Deshacer") { toasts.success("Cita restaurada") }) },
                    block = true,
                )
                Box {
                    Button("Menú", { menu = true })
                    Menu(menu, { menu = false }) {
                        item("Editar", {})
                        item("Duplicar", {})
                        separator()
                        radioItem("Por nombre", sort == "name", { sort = "name" })
                        radioItem("Por fecha", sort == "date", { sort = "date" })
                        separator()
                        item("Eliminar", {}, destructive = true)
                    }
                }
                Field("Barbero") { Select(Barbers, barber, { barber = it }, placeholder = "Elige un barbero") }
            }
            Sheet(
                open = sheet,
                onDismiss = { sheet = false },
                title = "Agregar a la cola",
                dismissLabel = "Cerrar",
                footer = {
                    Button("Agregar", {
                        sheet = false
                        toasts.success("Agregado a la cola")
                    }, variant = ButtonVariant.Primary, size = ButtonSize.Lg, block = true)
                },
            ) {
                Field("Nombre") { Input("", {}, placeholder = "Cliente") }
                repeat(30) { Text("Servicio ${it + 1}", Modifier.fillMaxWidth().padding(vertical = 12.dp)) }
            }
            Dialog(
                open = dialog,
                onDismissRequest = { dialog = false },
                title = "¿Cancelar la cita?",
                description = "El cliente recibirá un aviso.",
                dismissLabel = "Cerrar",
                actions = {
                    Button("Volver", { dialog = false })
                    Button("Cancelar cita", {
                        dialog = false
                        toasts.error("Cita cancelada")
                    }, variant = ButtonVariant.Danger)
                },
            )
            Toaster(toasts)
        }
    }
}
