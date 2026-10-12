package com.jcsoftdev.ui.screenshots

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.atoms.Button
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.overlays.Dialog
import com.jcsoftdev.ui.overlays.Sheet
import org.junit.Assume.assumeTrue
import kotlin.test.Test

/**
 * Glass over busy stripes. These shots are NOT part of the committed golden set: goldens of record are Linux ones recorded by
 * the `ui-compose-record` workflow, and a macOS-recorded glass golden would differ in blur rasterization. They only run with
 * `GLASS_SHOTS=1` (for example `GLASS_SHOTS=1 ./gradlew :kit:recordRoborazziJvm --tests '*GlassShots*'`), to inspect the look
 * locally; record them on CI before adding them to the verified set.
 */
class GlassShots {
    private fun enabled() = assumeTrue(System.getenv("GLASS_SHOTS") == "1")

    @Composable
    private fun Busy() {
        Row(Modifier.fillMaxSize()) {
            repeat(60) { Box(Modifier.size(12.dp, 800.dp).background(if (it % 2 == 0) Color(0xFFEF476F) else Color(0xFF118AB2))) }
        }
    }

    @Test fun glassSheet() {
        enabled()
        shoot("glass", "sheet", height = 560.dp, style = com.jcsoftdev.ui.theme.UiStyle.Glass) {
            Busy()
            Sheet(open = true, onDismiss = {}, title = "Glass sheet") { repeat(5) { Text("Row ${it + 1}") } }
        }
    }

    @Test fun glassDialog() {
        enabled()
        shoot("glass", "dialog", height = 440.dp, style = com.jcsoftdev.ui.theme.UiStyle.Glass) {
            Busy()
            Dialog(
                open = true,
                onDismissRequest = {},
                title = "Glass dialog",
                description = "Blurs what is behind it.",
                actions = { Button("OK", {}) },
            )
        }
    }
}
