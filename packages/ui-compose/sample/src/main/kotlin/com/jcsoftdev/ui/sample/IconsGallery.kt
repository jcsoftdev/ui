package com.jcsoftdev.ui.sample

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.icons.AlertTriangle
import com.jcsoftdev.ui.icons.Bell
import com.jcsoftdev.ui.icons.Calendar
import com.jcsoftdev.ui.icons.Check
import com.jcsoftdev.ui.icons.ChevronRight
import com.jcsoftdev.ui.icons.Clock
import com.jcsoftdev.ui.icons.Icon
import com.jcsoftdev.ui.icons.Icons
import com.jcsoftdev.ui.icons.Search
import com.jcsoftdev.ui.icons.Settings
import com.jcsoftdev.ui.icons.Trash2
import com.jcsoftdev.ui.icons.User
import com.jcsoftdev.ui.icons.X
import com.jcsoftdev.ui.theme.UiTheme

// Only the icons referenced here survive R8 in the release sample; the rest of the set costs nothing.
private val Showcase: List<Pair<String, ImageVector>>
    get() =
        listOf(
            "Calendar" to Icons.Calendar,
            "Clock" to Icons.Clock,
            "User" to Icons.User,
            "Bell" to Icons.Bell,
            "Search" to Icons.Search,
            "Settings" to Icons.Settings,
            "Check" to Icons.Check,
            "X" to Icons.X,
            "ChevronRight" to Icons.ChevronRight,
            "Trash2 (alias)" to Icons.Trash2,
            "AlertTriangle (alias)" to Icons.AlertTriangle,
        )

@Composable
fun IconsGallery() {
    UiTheme(dark = false, accent = "#77D3AD") {
        Column(
            Modifier
                .background(UiTheme.colors.bg)
                .statusBarsPadding()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("Icons", style = UiTheme.typography.pageTitle)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Showcase.forEach { (name, icon) ->
                    Column(Modifier.width(96.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(icon, contentDescription = null)
                        Text(name, style = UiTheme.typography.meta, color = UiTheme.colors.ink3)
                    }
                }
            }
        }
    }
}
