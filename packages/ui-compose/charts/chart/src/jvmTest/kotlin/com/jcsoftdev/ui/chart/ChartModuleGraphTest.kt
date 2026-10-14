package com.jcsoftdev.ui.chart

import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Guards the pay-for-what-you-use module graph, in the spirit of LiquidReachabilityTest: an app that names one family must
 * not pull another. Read from the build files and the sources, so a wrong edge fails before it is ever published.
 *  - a family depends only on `chart` (and so `chart-core`), plus the two drawn edges stock -> plots and crossfilter -> cartesian;
 *  - `chart-core` and the data artifacts depend on nothing, and `chart-core` has no Compose;
 *  - no module depends on `chart-export`, and no source imports another module's package without a declared edge;
 *  - family layout math (`...<family>.layout`) imports no Compose.
 */
class ChartModuleGraphTest {
    private val root =
        generateSequence(File(System.getProperty("user.dir")).absoluteFile) { it.parentFile }
            .first { it.resolve("settings.gradle.kts").isFile }
    private val chartsDir = root.resolve("charts")

    @Test fun everyRegisteredModuleHasADeclaredEdgeSet() {
        val onDisk = chartsDir.listFiles { file -> file.isDirectory && file.resolve("build.gradle.kts").isFile }!!.map { it.name }
        assertEquals(EDGES.keys.sorted(), onDisk.sorted(), "charts/ holds exactly the modules the graph declares")
        val settings = root.resolve("settings.gradle.kts").readText()
        EDGES.keys.forEach { assertTrue("\"$it\"" in settings, "$it is registered in settings.gradle.kts") }
    }

    @Test fun gradleDependenciesMatchTheDeclaredEdges() {
        val offenders =
            EDGES.mapNotNull { (module, allowed) ->
                val declared = projectDependencies(chartsDir.resolve("$module/build.gradle.kts"))
                if (declared == allowed) null else "$module declares $declared, the graph allows $allowed"
            }
        assertEquals(emptyList(), offenders, "Gradle dependencies follow the module graph")
    }

    @Test fun onlyTwoFamilyToFamilyEdgesExist() {
        val familyEdges =
            EDGES.flatMap { (module, deps) -> deps.filter { it in FAMILIES && module in FAMILIES }.map { module to it } }
        assertEquals(listOf("chart-crossfilter" to "chart-cartesian", "chart-stock" to "chart-plots"), familyEdges.sortedBy { it.first })
        assertTrue(EDGES.values.none { "chart-export" in it }, "nothing depends on chart-export")
    }

    @Test fun sourcesImportOnlyTheirDeclaredEdges() {
        val offenders = mutableListOf<String>()
        var scanned = 0
        EDGES.forEach { (module, allowed) ->
            val permitted = setOf(module) + allowed + allowed.flatMap { transitive(it) }
            sources(module).forEach { file ->
                scanned++
                file.readLines().filter { it.startsWith("import ") }.forEach { line ->
                    val target = moduleOfPackage(line.removePrefix("import ").trim())
                    if (target != null && target !in permitted) offenders += "${file.name} ($module) imports ${line.trim()} from $target"
                }
            }
        }
        assertTrue(scanned >= EDGES.size, "scanned a source file per module ($scanned)")
        assertEquals(emptyList(), offenders, "A module imports code outside its declared edges")
    }

    @Test fun chartCoreAndLayoutMathAreComposeFree() {
        val offenders = mutableListOf<String>()
        EDGES.keys.forEach { module ->
            sources(module).forEach { file ->
                val pureMath = module == "chart-core" || file.parentFile.name == "layout"
                if (!pureMath) return@forEach
                file.readLines().filter { it.startsWith("import ") }.forEach { line ->
                    val target = line.removePrefix("import ").trim()
                    val compose = target.startsWith("androidx.compose") || target.startsWith("org.jetbrains.compose")
                    val foreign =
                        module == "chart-core" &&
                            target.startsWith("com.jcsoftdev.ui.") &&
                            !target.startsWith("com.jcsoftdev.ui.chart.core")
                    if (compose || foreign) offenders += "${file.name} ($module) imports $target"
                }
            }
        }
        assertEquals(emptyList(), offenders, "Pure chart math imports Compose")
    }

    @Test fun theGuardSeesTheDeclaredEdges() {
        // Without these the scan could pass by reading nothing.
        assertEquals(setOf("chart", "chart-plots"), projectDependencies(chartsDir.resolve("chart-stock/build.gradle.kts")))
        assertEquals(setOf("chart-core", "kit"), projectDependencies(chartsDir.resolve("chart/build.gradle.kts")))
        assertEquals("chart-stock", moduleOfPackage("com.jcsoftdev.ui.chart.stock.StockModule"))
        assertEquals("chart", moduleOfPackage("com.jcsoftdev.ui.chart.ChartState"))
        assertEquals("chart-geo-world", moduleOfPackage("com.jcsoftdev.ui.chart.geo.world.Data"))
    }

    private fun projectDependencies(buildFile: File): Set<String> = PROJECT.findAll(buildFile.readText()).map { it.groupValues[1] }.toSet()

    private fun transitive(module: String): Set<String> = EDGES[module].orEmpty().flatMap { setOf(it) + transitive(it) }.toSet()

    private fun sources(module: String): List<File> =
        chartsDir
            .resolve("$module/src")
            .walkTopDown()
            .filter { it.isFile && it.extension == "kt" }
            .toList()

    // The longest package prefix wins, so chart.geo.world is the data artifact and not the geo family.
    private fun moduleOfPackage(name: String): String? =
        PACKAGES.entries
            .filter { (prefix, _) -> name == prefix || name.startsWith("$prefix.") }
            .maxByOrNull { it.key.length }
            ?.value

    private companion object {
        val PROJECT = Regex("""project\(":([a-z-]+)"\)""")
        val FAMILIES =
            setOf(
                "chart-cartesian",
                "chart-race",
                "chart-distribution",
                "chart-plots",
                "chart-polar",
                "chart-hierarchy",
                "chart-units",
                "chart-gantt",
                "chart-stock",
                "chart-crossfilter",
                "chart-geo",
            )

        // module -> the project dependencies its build file may declare.
        val EDGES: Map<String, Set<String>> =
            mapOf(
                "chart-core" to emptySet(),
                "chart" to setOf("chart-core", "kit"),
                "chart-stock" to setOf("chart", "chart-plots"),
                "chart-crossfilter" to setOf("chart", "chart-cartesian"),
                "chart-geo-world" to emptySet(),
                "chart-geo-peru" to emptySet(),
            ) + (FAMILIES - setOf("chart-stock", "chart-crossfilter")).plus("chart-export").associateWith { setOf("chart") }

        val PACKAGES: Map<String, String> =
            mapOf(
                "com.jcsoftdev.ui.chart.core" to "chart-core",
                "com.jcsoftdev.ui.chart" to "chart",
                "com.jcsoftdev.ui.chart.geo.world" to "chart-geo-world",
                "com.jcsoftdev.ui.chart.geo.peru" to "chart-geo-peru",
            ) + (FAMILIES + "chart-export").associate { "com.jcsoftdev.ui.${it.replace('-', '.')}" to it }
    }
}
