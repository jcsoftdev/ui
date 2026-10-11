package com.jcsoftdev.ui.screenshots

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.padding
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.icons.Calendar
import com.jcsoftdev.ui.icons.Check
import com.jcsoftdev.ui.icons.ChevronRight
import com.jcsoftdev.ui.icons.Icon
import com.jcsoftdev.ui.icons.Icons
import com.jcsoftdev.ui.icons.Plus
import com.jcsoftdev.ui.icons.Search
import com.jcsoftdev.ui.icons.Trash2
import com.jcsoftdev.ui.icons.X
import kotlin.test.Test

class IconsShots {
    @Test fun sampleOfTheSet() =
        shoot("icons", "icons") {
            FlowRow(Modifier.padding(12.dp), Arrangement.spacedBy(12.dp), Arrangement.spacedBy(12.dp)) {
                listOf(Icons.Calendar, Icons.Check, Icons.ChevronRight, Icons.Plus, Icons.Search, Icons.Trash2, Icons.X)
                    .forEach { Icon(it, contentDescription = null, size = 24.dp) }
            }
        }
}
