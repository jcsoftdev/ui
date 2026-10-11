package com.jcsoftdev.ui.sample

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CutCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jcsoftdev.ui.primitives.AnchoredPopup
import com.jcsoftdev.ui.primitives.DigitMask
import com.jcsoftdev.ui.primitives.ModalLayer
import com.jcsoftdev.ui.primitives.ToastHost
import com.jcsoftdev.ui.primitives.ToastHostState
import com.jcsoftdev.ui.primitives.menuGroup
import com.jcsoftdev.ui.primitives.menuRadioItem
import com.jcsoftdev.ui.primitives.rememberMaskedInputState
import com.jcsoftdev.ui.primitives.rememberOverlayPresence
import com.jcsoftdev.ui.primitives.rememberSheetState
import com.jcsoftdev.ui.primitives.sheetDraggable
import com.jcsoftdev.ui.primitives.sheetTranslation
import com.jcsoftdev.ui.theme.UiStrings
import com.jcsoftdev.ui.theme.UiTheme

private val Ink = Color(0xFF1B1B2F)
private val Neon = Color(0xFFFFD166)
private val Paper = Color(0xFFF4EFE6)
private val Cut = CutCornerShape(12.dp)
private val Mono = TextStyle(fontFamily = FontFamily.Monospace, fontSize = 15.sp, color = Ink)
private val TimeMask = DigitMask(4, ':', listOf(2))

/** A custom sheet, menu, toast and time field built only from the headless primitives; no kit component is used. */
@Composable
fun HeadlessGallery() {
    UiTheme(dark = false, strings = UiStrings.Es) {
        val toasts = remember { ToastHostState() }
        var sheet by remember { mutableStateOf(false) }
        var menu by remember { mutableStateOf(false) }
        var sort by remember { mutableStateOf("name") }
        var time by remember { mutableStateOf("") }
        Column(
            Modifier
                .fillMaxSize()
                .background(Paper)
                .statusBarsPadding()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            BasicText("Headless primitives", style = Mono.copy(fontSize = 20.sp))
            ChunkyButton("Open sheet") { sheet = true }
            Box {
                ChunkyButton("Sort: $sort") { menu = true }
                AnchoredPopup(menu, { menu = false }) {
                    Column(
                        Modifier
                            .width(180.dp)
                            .background(Ink, Cut)
                            .menuGroup()
                            .padding(6.dp),
                    ) {
                        listOf("name", "date", "price").forEach { key ->
                            BasicText(
                                if (key == sort) "> $key" else key,
                                Modifier
                                    .fillMaxWidth()
                                    .menuRadioItem(key == sort) {
                                        sort = key
                                        menu = false
                                    }.padding(12.dp),
                                style = Mono.copy(color = Neon),
                            )
                        }
                    }
                }
            }
            ChunkyButton("Show toast") { toasts.success("Saved at ${time.ifEmpty { "--:--" }}") }
            val input = rememberMaskedInputState(time, { time = it }, TimeMask) { d -> if (d.length == 4) d else "" }
            BasicTextField(
                input.digits,
                input::onInput,
                Modifier.fillMaxWidth().border(2.dp, Ink, Cut).padding(12.dp),
                textStyle = Mono,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                visualTransformation = input.visualTransformation,
                singleLine = true,
            )
        }
        CustomSheet(sheet) { sheet = false }
        ToastHost(toasts, contentPadding = PaddingValues(16.dp)) { toast ->
            BasicText(
                toast.message,
                Modifier
                    .background(
                        Neon,
                        Cut,
                    ).border(2.dp, Ink, Cut)
                    .padding(horizontal = 16.dp, vertical = 12.dp)
                    .clickable { toasts.dismiss(toast.id) },
                style = Mono,
            )
        }
    }
}

@Composable
private fun CustomSheet(
    open: Boolean,
    onClose: () -> Unit,
) {
    val presence = rememberOverlayPresence(open)
    val sheet = rememberSheetState()
    ModalLayer(
        open = open,
        present = presence.present,
        onDismissRequest = onClose,
        dismissLabel = UiTheme.strings.close,
        scrim = { tap ->
            Box(tap.fillMaxSize().graphicsLayer { alpha = sheet.scrimAlpha(presence.progress) * 0.6f }.background(Ink))
        },
    ) {
        Column(
            Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .sheetTranslation(sheet) { presence.progress }
                .background(Paper, Cut)
                .navigationBarsPadding()
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Box(Modifier.fillMaxWidth().sheetDraggable(sheet, onClose, isOpen = { open }).padding(vertical = 8.dp)) {
                BasicText("Drag me down", style = Mono.copy(fontSize = 18.sp))
            }
            BasicText("This sheet is a ModalLayer + SheetState + two modifiers.", style = Mono)
            ChunkyButton("Done", onClick = onClose)
        }
    }
}

@Composable
private fun ChunkyButton(
    label: String,
    onClick: () -> Unit,
) {
    Row(Modifier.background(Ink, Cut).clickable(onClick = onClick).padding(horizontal = 18.dp, vertical = 12.dp)) {
        BasicText(label, style = Mono.copy(color = Neon))
    }
}
