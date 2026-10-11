package com.jcsoftdev.ui.screenshots

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.atoms.Avatar
import com.jcsoftdev.ui.atoms.Button
import com.jcsoftdev.ui.atoms.ButtonSize
import com.jcsoftdev.ui.atoms.ButtonVariant
import com.jcsoftdev.ui.atoms.Chip
import com.jcsoftdev.ui.atoms.ChipTone
import com.jcsoftdev.ui.atoms.Divider
import com.jcsoftdev.ui.atoms.Switch
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.containers.Banner
import com.jcsoftdev.ui.containers.BannerTone
import com.jcsoftdev.ui.containers.Card
import com.jcsoftdev.ui.containers.ListRow
import com.jcsoftdev.ui.containers.PageHeader
import com.jcsoftdev.ui.icons.ChevronRight
import com.jcsoftdev.ui.icons.Icon
import com.jcsoftdev.ui.icons.Icons
import kotlin.test.Test

class ContainersShots {
    private val pad = Modifier.padding(12.dp)
    private val gap = Arrangement.spacedBy(8.dp)

    @Test fun banner() =
        shoot("containers", "banner") {
            Column(pad, gap) {
                Banner("Your payment was recorded.", tone = BannerTone.Success, title = "Done", onDismiss = {})
                Banner("Check the details before continuing.", tone = BannerTone.Warning)
                Banner(
                    "We could not save the changes.",
                    tone = BannerTone.Danger,
                    action = { Button("Retry", {}, size = ButtonSize.Sm) },
                )
                Banner("Booking opens at 9:00.")
            }
        }

    @Test fun card() =
        shoot("containers", "card") {
            Column(pad, gap) {
                Card(
                    onClick = {},
                    header = {
                        Text("Order 1042", Modifier.weight(1f))
                        Chip("Paid", tone = ChipTone.Success)
                    },
                    footer = { Text("Today, 10:30") },
                ) { Text("Haircut and beard with Ana Ruiz") }
                Card { Text("Card without an action") }
            }
        }

    @Test fun listRow() =
        shoot("containers", "list-row") {
            Column(pad) {
                for ((index, name) in listOf("Classic cut", "Beard", "Cut and beard").withIndex()) {
                    ListRow(
                        title = name,
                        subtitle = "30 min",
                        meta = "S/ 35",
                        leading = { Avatar(name) },
                        trailing = { Icon(Icons.ChevronRight, null) },
                        selected = index == 1,
                        onClick = {},
                    )
                    Divider()
                }
                ListRow(title = "Notifications", trailing = { Switch(true, {}, contentDescription = "Notifications") })
            }
        }

    @Test fun pageHeader() =
        shoot("containers", "page-header") {
            PageHeader(
                title = "Agenda",
                eyebrow = "Miraflores branch",
                lede = "Today's appointments",
                onBack = {},
                actions = { Button("New", {}, variant = ButtonVariant.Primary, size = ButtonSize.Sm) },
                modifier = pad,
            )
        }
}
