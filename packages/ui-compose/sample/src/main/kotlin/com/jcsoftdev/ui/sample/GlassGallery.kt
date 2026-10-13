package com.jcsoftdev.ui.sample

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.atoms.Button
import com.jcsoftdev.ui.atoms.ButtonVariant
import com.jcsoftdev.ui.atoms.IconButton
import com.jcsoftdev.ui.atoms.Switch
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.containers.Card
import com.jcsoftdev.ui.glass.GlassVariant
import com.jcsoftdev.ui.glass.MaterialSurface
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
    variant: GlassVariant = GlassVariant.Frosted,
) {
    UiTheme(
        dark = dark,
        style = UiStyle.Glass,
        backdropBlur = blur,
        reduceTransparency = reduceTransparency,
        glassVariant = variant,
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
                item { SideBySide() }
                item { LightBackdrop() }
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

/** A photo-like backdrop drawn in code: gradient sky, colored discs and a grid of fine lines. */
@Composable
private fun Photo(modifier: Modifier = Modifier) {
    Canvas(modifier) {
        drawRect(Brush.verticalGradient(listOf(Color(0xFF1B4079), Color(0xFFFF7B54), Color(0xFFFFD166))))
        val discs = listOf(Color(0xFFEF476F), Color(0xFF06D6A0), Color(0xFF118AB2), Color(0xFFFFE066), Color(0xFF8338EC))
        discs.forEachIndexed { i, c ->
            drawCircle(
                c,
                size.height * (0.16f + 0.05f * i),
                Offset(size.width * (0.12f + 0.2f * i), size.height * (0.3f + 0.18f * (i % 2))),
            )
        }
        var x = 0f
        while (x < size.width) {
            drawLine(Color.Black.copy(alpha = 0.55f), Offset(x, 0f), Offset(x, size.height), 2f)
            x += 26f
        }
    }
}

/** Frosted and Liquid next to each other over the same backdrop; the Liquid one flexes when pressed. */
@Composable
private fun SideBySide() {
    val source = remember { MutableInteractionSource() }
    val glass = rememberGlassState()
    Box(Modifier.fillMaxWidth().height(220.dp).clip(RoundedCornerShape(20.dp))) {
        Photo(Modifier.fillMaxSize().glassSource(glass))
        Row(
            Modifier.align(Alignment.Center).padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            MaterialSurface(SurfaceMaterial.Glass, RoundedCornerShape(28.dp), Modifier.size(140.dp, 120.dp), glass = glass) {
                Text("Frosted", Modifier.align(Alignment.Center))
            }
            MaterialSurface(
                SurfaceMaterial.Liquid,
                RoundedCornerShape(28.dp),
                Modifier.size(140.dp, 120.dp).clickable(source, null) {},
                glass = glass,
                interactionSource = source,
            ) { Text("Liquid", Modifier.align(Alignment.Center)) }
        }
    }
}

/** A Liquid card and a Liquid capsule over light content with black and white stripes, like the floating bar over the page. */
@Composable
private fun LightBackdrop() {
    val glass = rememberGlassState()
    Box(Modifier.fillMaxWidth().height(160.dp).clip(RoundedCornerShape(20.dp))) {
        Canvas(Modifier.fillMaxSize().glassSource(glass)) {
            drawRect(Brush.verticalGradient(listOf(Color(0xFFEAF4F8), Color(0xFF58A6C9), Color(0xFF6DC3A0))))
            var x = 0f
            while (x < size.width) {
                drawRect(
                    Color.Black,
                    Offset(x, size.height * 0.62f),
                    androidx.compose.ui.geometry
                        .Size(26f, size.height * 0.38f),
                )
                x += 52f
            }
            // A straight grid, so a facet or crease in the refraction shows as a kink in the lines.
            var gx = 0f
            while (gx < size.width) {
                drawLine(Color.Black.copy(alpha = 0.7f), Offset(gx, 0f), Offset(gx, size.height), 2f)
                gx += 24f
            }
            var gy = 0f
            while (gy < size.height) {
                drawLine(Color.Black.copy(alpha = 0.7f), Offset(0f, gy), Offset(size.width, gy), 2f)
                gy += 24f
            }
        }
        Row(Modifier.align(Alignment.Center), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            MaterialSurface(SurfaceMaterial.Liquid, RoundedCornerShape(28.dp), Modifier.size(140.dp, 110.dp), glass = glass) {
                Text("Liquid card", Modifier.align(Alignment.Center))
            }
            MaterialSurface(
                SurfaceMaterial.Liquid,
                RoundedCornerShape(50),
                Modifier.size(150.dp, 56.dp).align(Alignment.CenterVertically),
                glass = glass,
            ) {
                Text("Liquid pill", Modifier.align(Alignment.Center))
            }
        }
    }
}
