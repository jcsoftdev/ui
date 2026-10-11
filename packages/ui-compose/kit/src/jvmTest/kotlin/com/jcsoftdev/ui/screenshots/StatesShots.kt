package com.jcsoftdev.ui.screenshots

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.atoms.Button
import com.jcsoftdev.ui.icons.CalendarX
import com.jcsoftdev.ui.icons.Icon
import com.jcsoftdev.ui.icons.Icons
import com.jcsoftdev.ui.states.EmptyState
import com.jcsoftdev.ui.states.ErrorState
import com.jcsoftdev.ui.states.OfflineBanner
import com.jcsoftdev.ui.states.Skeleton
import com.jcsoftdev.ui.states.SkeletonCircle
import com.jcsoftdev.ui.states.SkeletonGroup
import com.jcsoftdev.ui.states.SkeletonText
import kotlin.test.Test

class StatesShots {
    private val pad = Modifier.padding(12.dp)

    @Test fun emptyState() =
        shoot("states", "empty-state") {
            EmptyState(
                title = "No appointments today",
                description = "When a client books, the appointment appears here.",
                icon = { Icon(Icons.CalendarX, null, size = 32.dp) },
                action = { Button("New appointment", {}) },
                modifier = pad,
            )
        }

    @Test fun errorState() =
        shoot("states", "error-state") {
            ErrorState(
                title = "We could not load the agenda",
                description = "Your appointments are safe. Check your connection and try again.",
                correlationId = "7f3a-91c2",
                correlationLabel = "ID:",
                onRetry = {},
                modifier = pad,
            )
        }

    @Test fun offlineBanner() =
        shoot("states", "offline-banner") {
            Column(pad, Arrangement.spacedBy(8.dp)) {
                OfflineBanner("You are offline. We will save your changes.", queuedChanges = 3, queuedLabel = "3 changes queued")
                OfflineBanner("You are offline.")
            }
        }

    @Test fun skeleton() =
        shoot("states", "skeleton") {
            Column(pad, Arrangement.spacedBy(12.dp)) {
                Skeleton()
                SkeletonGroup(label = "Loading appointments") {
                    Row(Modifier, Arrangement.spacedBy(12.dp), Alignment.CenterVertically) {
                        SkeletonCircle()
                        SkeletonText(Modifier.weight(1f), lines = 2)
                    }
                    SkeletonText()
                }
            }
        }
}
