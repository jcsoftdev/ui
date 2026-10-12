package com.jcsoftdev.ui.sample

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.atoms.Button
import com.jcsoftdev.ui.atoms.ButtonVariant
import com.jcsoftdev.ui.atoms.IconButton
import com.jcsoftdev.ui.atoms.Switch
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.containers.Card
import com.jcsoftdev.ui.glass.SurfaceMaterial
import com.jcsoftdev.ui.glass.glassSource
import com.jcsoftdev.ui.glass.rememberGlassState
import com.jcsoftdev.ui.icons.Bell
import com.jcsoftdev.ui.icons.Icon
import com.jcsoftdev.ui.icons.Icons
import com.jcsoftdev.ui.icons.Plus
import com.jcsoftdev.ui.icons.Search
import com.jcsoftdev.ui.navigation.ActionBar
import com.jcsoftdev.ui.navigation.TopBar
import com.jcsoftdev.ui.overlays.Dialog
import com.jcsoftdev.ui.overlays.Sheet
import com.jcsoftdev.ui.overlays.Toaster
import com.jcsoftdev.ui.primitives.ToastHostState
import com.jcsoftdev.ui.theme.UiStyle
import com.jcsoftdev.ui.theme.UiTheme

private val Hues =
    listOf(
        Color(0xFFFF6B6B) to Color(0xFFFFD93D),
        Color(0xFF4D96FF) to Color(0xFF6BCB77),
        Color(0xFF9D4EDD) to Color(0xFFFF9E00),
        Color(0xFF00B4D8) to Color(0xFFEF476F),
    )

/**
 * Glass over busy content: stripes and gradients scroll under a glass [TopBar] and [ActionBar]; the sheet and dialog blur the
 * whole screen. [blur] false shows the tint-only fallback, [open] ("sheet", "dialog") opens an overlay on start.
 */
@Composable
fun GlassGallery(
    dark: Boolean = false,
    blur: Boolean = true,
    reduceTransparency: Boolean = false,
    open: String? = null,
) {
    UiTheme(
        dark = dark,
        style = UiStyle.Glass,
        backdropBlur = blur,
        reduceTransparency = reduceTransparency,
        highContrast = false,
    ) {
        val glass = rememberGlassState()
        val toasts = remember { ToastHostState() }
        var sheet by remember { mutableStateOf(open == "sheet") }
        var dialog by remember { mutableStateOf(open == "dialog") }
        var clear by remember { mutableStateOf(false) }
        Box(Modifier.fillMaxSize().background(UiTheme.colors.bg)) {
            LazyColumn(
                Modifier.fillMaxSize().glassSource(glass),
                contentPadding = PaddingValues(top = 120.dp, bottom = 120.dp, start = 16.dp, end = 16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button("Open glass sheet", { sheet = true }, block = true, variant = ButtonVariant.Primary)
                        Button("Open glass dialog", { dialog = true }, block = true)
                        Button("Toast", { toasts.success("Saved") }, block = true)
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            Switch(clear, { clear = it }, contentDescription = "Clear glass")
                            Text("Clear variant on the cards")
                        }
                    }
                }
                items(Hues + Hues + Hues) { (a, b) ->
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .height(120.dp)
                            .background(Brush.linearGradient(listOf(a, b)), RoundedCornerShape(20.dp)),
                    ) {
                        Card(
                            Modifier.align(Alignment.BottomStart).padding(12.dp),
                            material = if (clear) SurfaceMaterial.GlassClear else SurfaceMaterial.Glass,
                        ) { Text("Glass card over a gradient", Modifier.padding(4.dp)) }
                    }
                    Row(Modifier.fillMaxWidth().height(24.dp)) {
                        repeat(24) { Box(Modifier.size(14.dp, 24.dp).background(if (it % 2 == 0) Color.Black else Color.White)) }
                    }
                }
            }
            TopBar(
                "Glass",
                Modifier.align(Alignment.TopCenter),
                glass = glass,
                actions = { IconButton({}, "Search") { Icon(Icons.Search, null) } },
            )
            ActionBar(Modifier.align(Alignment.BottomCenter).navigationBarsPadding().padding(16.dp), glass = glass) {
                IconButton({}, "Add") { Icon(Icons.Plus, null) }
                IconButton({}, "Notifications") { Icon(Icons.Bell, null) }
            }
            Sheet(open = sheet, onDismiss = { sheet = false }, title = "Glass sheet") {
                repeat(8) { Text("Row ${it + 1}", Modifier.fillMaxWidth().padding(vertical = 12.dp)) }
            }
            Dialog(
                open = dialog,
                onDismissRequest = { dialog = false },
                title = "Glass dialog",
                description = "Blurs the content behind it.",
                actions = { Button("Close", { dialog = false }) },
            )
            Toaster(toasts)
        }
    }
}
