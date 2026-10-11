package com.jcsoftdev.ui.screenshots

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
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
import kotlin.test.Test

class FormsShots {
    private val pad = Modifier.padding(12.dp)
    private val gap = Arrangement.spacedBy(12.dp)

    @Test fun field() =
        shoot("forms", "field") {
            Column(pad, gap) {
                Field("Name", required = true, description = "As on the ID") { Input("Juan Carlos", {}) }
                Field("Phone", optionalLabel = "optional") { Input("", {}, placeholder = "999 999 999") }
                Field("Email", error = "Enter a valid email") { Input("juan@", {}) }
            }
        }

    @Test fun input() =
        shoot("forms", "input") {
            Column(pad, gap) {
                Input("Filled value", {})
                Input("", {}, placeholder = "Placeholder")
                Input("Invalid", {}, isError = true)
                Input("Disabled", {}, enabled = false)
            }
        }

    @Test fun passwordInput() =
        shoot("forms", "password-input") {
            Column(pad, gap) {
                PasswordInput("secret", {})
                PasswordInput("", {}, placeholder = "Password", isError = true)
            }
        }

    @Test fun timeAndDateInputs() =
        shoot("forms", "time-date-inputs") {
            Column(pad, gap) {
                TimeInput("0930", {}, placeholder = "HH:mm")
                DateInput("25122026", {}, placeholder = "dd/MM/yyyy")
                TimeInput("", {}, placeholder = "HH:mm")
            }
        }

    @Test fun pinInput() =
        shoot("forms", "pin-input") {
            Column(pad, gap) {
                PinInput("123", {}, contentDescription = "Code")
                PinInput("", {}, length = 4, isError = true, contentDescription = "Code")
            }
        }

    @Test fun numberStepper() =
        shoot("forms", "number-stepper") {
            Column(pad, gap) {
                NumberStepper(3, {}, max = 10)
                NumberStepper(0, {}, max = 10)
                NumberStepper(10, {}, max = 10)
            }
        }

    @Test fun select() =
        shoot("forms", "select") {
            val options = listOf(SelectOption("a", "Miraflores"), SelectOption("b", "San Isidro"))
            Column(pad, gap) {
                Select(options, "a", {}, placeholder = "Branch")
                Select(options, null, {}, placeholder = "Branch")
                Select(options, null, {}, placeholder = "Branch", isError = true)
            }
        }

    @Test fun segmented() =
        shoot("forms", "segmented") {
            Segmented(
                listOf(SegmentedOption("day", "Day"), SegmentedOption("week", "Week"), SegmentedOption("month", "Month")),
                "week",
                {},
                pad,
            )
        }

    @Test fun tabs() =
        shoot("forms", "tabs") {
            Tabs(listOf(TabItem("a", "Appointments", 3), TabItem("b", "Clients"), TabItem("c", "Stock", 12)), "a", {}, pad)
        }
}
