package com.jcsoftdev.ui.sample

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
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
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.atoms.Avatar
import com.jcsoftdev.ui.atoms.Button
import com.jcsoftdev.ui.atoms.ButtonSize
import com.jcsoftdev.ui.atoms.ButtonVariant
import com.jcsoftdev.ui.atoms.Chip
import com.jcsoftdev.ui.atoms.ChipTone
import com.jcsoftdev.ui.atoms.Divider
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.containers.Banner
import com.jcsoftdev.ui.containers.BannerTone
import com.jcsoftdev.ui.containers.Card
import com.jcsoftdev.ui.containers.ListRow
import com.jcsoftdev.ui.containers.PageHeader
import com.jcsoftdev.ui.icons.CalendarX
import com.jcsoftdev.ui.icons.ChevronRight
import com.jcsoftdev.ui.icons.Icon
import com.jcsoftdev.ui.icons.Icons
import com.jcsoftdev.ui.states.EmptyState
import com.jcsoftdev.ui.states.ErrorState
import com.jcsoftdev.ui.states.OfflineBanner
import com.jcsoftdev.ui.states.SkeletonCircle
import com.jcsoftdev.ui.states.SkeletonGroup
import com.jcsoftdev.ui.states.SkeletonText
import com.jcsoftdev.ui.theme.UiTheme

@Composable
fun StatesGallery() {
    Column(Modifier.statusBarsPadding().verticalScroll(rememberScrollState())) {
        Panel(dark = false)
        Panel(dark = true)
    }
}

@Composable
private fun Panel(dark: Boolean) {
    UiTheme(dark = dark, accent = "#77D3AD") {
        var selected by remember { mutableStateOf("a") }
        var banner by remember { mutableStateOf(true) }
        var taps by remember { mutableStateOf(0) }
        Column(Modifier.background(UiTheme.colors.bg).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            PageHeader(
                title = "Agenda",
                eyebrow = if (dark) "Oscuro" else "Claro",
                lede = "Citas de hoy en la sucursal Miraflores",
                onBack = {},
                backLabel = "Atrás",
                actions = { Button("Nueva", {}, variant = ButtonVariant.Primary, size = ButtonSize.Sm) },
            )
            OfflineBanner("Sin conexión. Guardaremos tus cambios.", queuedChanges = 3, queuedLabel = "3 cambios en cola")
            if (banner) {
                Banner(
                    "Tu pago se registró correctamente.",
                    tone = BannerTone.Success,
                    title = "Listo",
                    onDismiss = { banner = false },
                    dismissLabel = "Cerrar",
                )
            }
            Banner("Revisa los datos antes de continuar.", tone = BannerTone.Warning)
            Banner("No pudimos guardar los cambios.", tone = BannerTone.Danger, action = { Button("Reintentar", {}, size = ButtonSize.Sm) })
            Banner("La reserva se abre a las 9:00.")
            Card(
                onClick = { taps++ },
                onClickLabel = "Abrir pedido",
                header = {
                    Text("Pedido 1042", Modifier.weight(1f))
                    Chip("Pagado", tone = ChipTone.Success)
                },
                footer = { Text("Toques: $taps") },
            ) { Text("Corte y barba con Ana Ruiz") }
            Card { Text("Tarjeta sin acción") }
            Column {
                for ((id, name) in listOf("a" to "Corte clásico", "b" to "Barba", "c" to "Corte y barba")) {
                    ListRow(
                        title = name,
                        subtitle = "30 min",
                        meta = "S/ 35",
                        leading = { Avatar(name) },
                        trailing = { Icon(Icons.ChevronRight, null) },
                        selected = selected == id,
                        onClick = { selected = id },
                    )
                    Divider()
                }
            }
            EmptyState(
                title = "Sin citas para hoy",
                description = "Cuando un cliente reserve, su cita aparecerá aquí.",
                icon = { Icon(Icons.CalendarX, null, size = 32.dp) },
                action = { Button("Nueva cita", {}) },
            )
            ErrorState(
                title = "No pudimos cargar la agenda",
                description = "Tus citas están a salvo. Revisa tu conexión e inténtalo de nuevo.",
                correlationId = "7f3a-91c2",
                correlationLabel = "ID:",
                onRetry = {},
                retryLabel = "Reintentar",
            )
            SkeletonGroup(label = "Cargando citas") {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    SkeletonCircle()
                    SkeletonText(Modifier.weight(1f), lines = 2)
                }
                SkeletonText()
            }
        }
    }
}
