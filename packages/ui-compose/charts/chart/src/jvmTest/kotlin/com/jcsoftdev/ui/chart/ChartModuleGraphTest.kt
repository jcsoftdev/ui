package com.jcsoftdev.ui.chart

import com.jcsoftdev.ui.chart.ModuleGuard.EDGES
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Guards the pay-for-what-you-use module graph in the spirit of LiquidReachabilityTest. The `jvmTest` task of `:chart` declares the
 * resolved graph of every chart module, their sources, settings and the catalog as inputs, so the build cache re-runs it when any
 * of them changes. The rules and their bypasses are in [ModuleGuard] and [ModuleGuardTest].
 */
class ChartModuleGraphTest {
    private val root = File(checkNotNull(System.getProperty("chart.root")) { "chart.root is set by the jvmTest task" })
    private val chartsDir = root.resolve("charts")

    @Test fun everyRegisteredModuleHasADeclaredEdgeSet() {
        val onDisk = chartsDir.listFiles { file -> file.isDirectory && file.resolve("build.gradle.kts").isFile }!!.map { it.name }
        assertEquals(EDGES.keys.sorted(), onDisk.sorted(), "charts/ holds exactly the modules the graph declares")
        val settings = root.resolve("settings.gradle.kts").readText()
        EDGES.keys.forEach { assertTrue("\"$it\"" in settings, "$it is registered in settings.gradle.kts") }
    }

    @Test fun theResolvedGraphOfEveryModuleFollowsTheDeclaredEdges() {
        val offenders =
            EDGES.keys.flatMap { module ->
                val report = chartsDir.resolve("$module/build/module-graph.txt")
                assertTrue(report.isFile, "writeModuleGraph ran for $module")
                ModuleGuard.graphViolations(module, report.readText())
            }
        assertEquals(emptyList(), offenders, "A module resolves a dependency outside its declared edges")
    }

    @Test fun sourcesFollowTheDeclaredEdgesAndKeepPureMathFree() {
        var scanned = 0
        val offenders =
            EDGES.keys.flatMap { module ->
                chartsDir
                    .resolve("$module/src")
                    .walkTopDown()
                    .filter {
                        it.isFile &&
                            it.extension == "kt" &&
                            it
                                .relativeTo(chartsDir.resolve("$module/src"))
                                .path
                                .substringBefore('/')
                                .endsWith("Main")
                    }.toList()
                    .flatMap { file ->
                        scanned++
                        ModuleGuard.sourceViolations(module, file.relativeTo(chartsDir.resolve(module)).path, file.readText())
                    }
            }
        assertTrue(scanned >= EDGES.size, "scanned a main source file per module ($scanned)")
        assertEquals(emptyList(), offenders, "A source names code outside its declared edges")
    }

    @Test fun theOnlyFamilyToFamilyEdgesAreStockAndCrossfilter() {
        val familyEdges =
            EDGES.flatMap { (module, deps) ->
                deps.filter { it in ModuleGuard.FAMILIES && module in ModuleGuard.FAMILIES }.map {
                    module to
                        it
                }
            }
        assertEquals(listOf("chart-crossfilter" to "chart-cartesian", "chart-stock" to "chart-plots"), familyEdges.sortedBy { it.first })
        assertTrue(EDGES.values.none { "chart-export" in it }, "nothing depends on chart-export")
    }
}
