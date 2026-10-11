package com.jcsoftdev.ui.screenshots

import androidx.compose.runtime.remember
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.atoms.Button
import com.jcsoftdev.ui.atoms.ButtonSize
import com.jcsoftdev.ui.atoms.ButtonVariant
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.forms.Field
import com.jcsoftdev.ui.forms.Input
import com.jcsoftdev.ui.overlays.Dialog
import com.jcsoftdev.ui.overlays.Sheet
import com.jcsoftdev.ui.overlays.Toaster
import com.jcsoftdev.ui.primitives.ToastAction
import com.jcsoftdev.ui.primitives.ToastHostState
import kotlin.test.Test

/** Overlays draw inside the themed window, so they get a fixed phone-sized frame. Menu opens a platform popup and has no golden. */
class OverlaysShots {
    @Test fun sheet() =
        shoot("overlays", "sheet", height = 560.dp) {
            Sheet(
                open = true,
                onDismiss = {},
                title = "Add to the queue",
                footer = { Button("Add", {}, variant = ButtonVariant.Primary, size = ButtonSize.Lg, block = true) },
            ) {
                Field("Name") { Input("", {}, placeholder = "Client") }
                repeat(12) { Text("Service ${it + 1}") }
            }
        }

    @Test fun dialog() =
        shoot("overlays", "dialog", height = 440.dp) {
            Dialog(
                open = true,
                onDismissRequest = {},
                title = "Cancel the appointment?",
                description = "The client will get a notice.",
                actions = {
                    Button("Back", {})
                    Button("Cancel appointment", {}, variant = ButtonVariant.Danger)
                },
            )
        }

    @Test fun toaster() =
        shoot("overlays", "toaster", height = 260.dp) {
            val toasts =
                remember {
                    ToastHostState().apply {
                        success("Appointment saved", durationMillis = ToastHostState.INDEFINITE)
                        info("Appointment cancelled", ToastAction("Undo") {}, durationMillis = ToastHostState.INDEFINITE)
                    }
                }
            Toaster(toasts)
        }
}
