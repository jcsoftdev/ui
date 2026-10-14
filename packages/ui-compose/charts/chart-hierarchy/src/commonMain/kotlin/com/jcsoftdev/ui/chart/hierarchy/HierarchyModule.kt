package com.jcsoftdev.ui.chart.hierarchy

import androidx.compose.runtime.Composable

/** Placeholder that keeps the empty module compiling and reachable from the size probe; the batch that fills it deletes this file. */
public object HierarchyModule {
    public val id: String = "chart-hierarchy"
}

/**
 * Stand-in the size probe renders until this module has a real chart. The batch that fills the module replaces it with a
 * representative chart and repoints the probe (see "Keeping the size probe representative" in odd/tasks/compose-charts.md).
 */
@Composable
public fun HierarchyPlaceholder() {
    // Intentionally empty.
}
