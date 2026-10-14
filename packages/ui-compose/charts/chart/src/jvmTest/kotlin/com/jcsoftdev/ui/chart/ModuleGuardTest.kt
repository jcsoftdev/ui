package com.jcsoftdev.ui.chart

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** Each way a module could slip past the graph, as a fixture the guard must flag; and the edges it must let through. */
class ModuleGuardTest {
    private fun source(
        pkg: String,
        body: String,
    ) = "package $pkg\n\n$body\n"

    private val cartesian = "com.jcsoftdev.ui.chart.cartesian"

    private fun flagged(
        module: String,
        path: String,
        text: String,
    ) = ModuleGuard.sourceViolations(module, path, text)

    @Test fun aCleanFamilyFilePasses() {
        val text =
            source(
                cartesian,
                "import com.jcsoftdev.ui.chart.ChartState\nimport com.jcsoftdev.ui.chart.core.Scale\nimport androidx.compose.runtime.Composable",
            )
        assertEquals(emptyList(), flagged("chart-cartesian", "src/commonMain/kotlin/A.kt", text))
    }

    @Test fun theDrawnFamilyEdgesPass() {
        val text = source("com.jcsoftdev.ui.chart.stock", "import com.jcsoftdev.ui.chart.plots.Candle")
        assertEquals(emptyList(), flagged("chart-stock", "src/commonMain/kotlin/A.kt", text))
        val cross = source("com.jcsoftdev.ui.chart.crossfilter", "import com.jcsoftdev.ui.chart.cartesian.Bar")
        assertEquals(emptyList(), flagged("chart-crossfilter", "src/commonMain/kotlin/A.kt", cross))
    }

    @Test fun aWildcardImportOfAnotherFamilyIsFlagged() {
        assertEquals(1, flagged("chart-cartesian", "A.kt", source(cartesian, "import com.jcsoftdev.ui.chart.plots.*")).size)
    }

    @Test fun anImportAliasOfAnotherFamilyIsFlagged() {
        assertEquals(1, flagged("chart-cartesian", "A.kt", source(cartesian, "import com.jcsoftdev.ui.chart.polar.Donut as D")).size)
    }

    @Test fun aQualifiedNameWithoutAnImportIsFlagged() {
        val text = source(cartesian, "val x = com.jcsoftdev.ui.chart.hierarchy.Sankey()")
        assertEquals(1, flagged("chart-cartesian", "A.kt", text).size)
    }

    @Test fun aFamilyNamingTheExportModuleIsFlagged() {
        assertEquals(1, flagged("chart-cartesian", "A.kt", source(cartesian, "import com.jcsoftdev.ui.chart.export.Csv")).size)
    }

    @Test fun theDataSubpackageIsNotTheGeoFamily() {
        val text = source("com.jcsoftdev.ui.chart.geo", "import com.jcsoftdev.ui.chart.geo.world.Data")
        assertEquals(1, flagged("chart-geo", "A.kt", text).size)
    }

    @Test fun aFileDeclaringAnotherModulesPackageIsFlagged() {
        assertTrue(flagged("chart-cartesian", "A.kt", source("com.jcsoftdev.ui.chart.plots", "val x = 1")).any { "declares package" in it })
    }

    @Test fun chartCoreNamingComposeOrTheKitIsFlagged() {
        val core = "com.jcsoftdev.ui.chart.core"
        assertTrue(flagged("chart-core", "A.kt", source(core, "import androidx.compose.ui.graphics.Color")).isNotEmpty())
        assertTrue(flagged("chart-core", "A.kt", source(core, "val c = androidx.compose.ui.graphics.Color.Red")).isNotEmpty())
        assertTrue(flagged("chart-core", "A.kt", source(core, "// uses org.jetbrains.compose.foundation")).isNotEmpty())
        assertTrue(flagged("chart-core", "A.kt", source(core, "import com.jcsoftdev.ui.theme.UiTheme")).isNotEmpty())
        assertTrue(flagged("chart-core", "A.kt", source(core, "import com.jcsoftdev.ui.chart.ChartState")).isNotEmpty())
    }

    @Test fun anyFileUnderALayoutDirectoryIsPureMath() {
        val text = source("$cartesian.layout.deep", "val x = androidx.compose.ui.geometry.Offset.Zero")
        assertEquals(1, flagged("chart-cartesian", "src/commonMain/kotlin/layout/deep/Nested.kt", text).size)
        assertEquals(
            1,
            flagged("chart-cartesian", "src/commonMain/kotlin/a/layout/Wild.kt", source(cartesian, "import androidx.compose.ui.*")).size,
        )
        assertEquals(
            emptyList(),
            flagged("chart-cartesian", "src/commonMain/kotlin/Draw.kt", source(cartesian, "import androidx.compose.ui.Modifier")),
        )
    }

    private fun report(vararg configs: Pair<String, List<String>>) =
        configs.joinToString("") { (name, lines) -> "config $name\n" + lines.joinToString("") { "$it\n" } }

    private fun both(lines: List<String>) = report("jvmRuntimeClasspath" to lines, "releaseRuntimeClasspath" to lines)

    @Test fun theResolvedGraphOfADeclaredEdgePasses() {
        assertEquals(
            emptyList(),
            ModuleGuard.graphViolations("chart-stock", both(listOf("direct project :chart", "direct project :chart-plots"))),
        )
    }

    @Test fun anUndeclaredProjectEdgeInAnyClasspathIsFlagged() {
        val clean = listOf("direct project :chart")
        val dirty = report("jvmRuntimeClasspath" to clean, "releaseRuntimeClasspath" to clean + "direct project :chart-plots")
        assertEquals(1, ModuleGuard.graphViolations("chart-cartesian", dirty).size)
        assertEquals(
            1,
            ModuleGuard.graphViolations("chart-cartesian", both(listOf("direct project :chart", "direct project :chart-export"))).size / 2,
        )
    }

    @Test fun composeResolvedIntoChartCoreOrADataModuleIsFlagged() {
        val lines = listOf("all module org.jetbrains.compose.runtime:runtime", "all module androidx.compose.ui:ui")
        assertEquals(4, ModuleGuard.graphViolations("chart-core", both(lines)).size)
        assertEquals(4, ModuleGuard.graphViolations("chart-geo-peru", both(lines)).size)
        assertEquals(emptyList(), ModuleGuard.graphViolations("chart-cartesian", both(listOf("direct project :chart") + lines)))
    }

    @Test fun aReportMissingAClasspathIsFlagged() {
        assertEquals(1, ModuleGuard.graphViolations("chart-core", report("jvmRuntimeClasspath" to emptyList())).size)
    }

    @Test fun theGuardKnowsThePackages() {
        assertEquals("chart-stock", ModuleGuard.moduleOfPackage("com.jcsoftdev.ui.chart.stock.StockModule"))
        assertEquals("chart", ModuleGuard.moduleOfPackage("com.jcsoftdev.ui.chart.ChartState"))
        assertEquals("chart-geo-world", ModuleGuard.moduleOfPackage("com.jcsoftdev.ui.chart.geo.world.Data"))
        assertEquals(null, ModuleGuard.moduleOfPackage("com.jcsoftdev.ui.theme.UiTheme"))
    }
}
