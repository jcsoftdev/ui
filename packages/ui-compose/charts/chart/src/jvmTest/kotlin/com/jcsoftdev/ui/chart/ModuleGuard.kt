package com.jcsoftdev.ui.chart

/**
 * The rules of the pay-for-what-you-use module graph, as pure functions over text so each bypass has a unit test:
 *  - a family depends only on `chart` (and so `chart-core`), plus stock -> plots and crossfilter -> cartesian;
 *  - `chart-core` and the geo data artifacts carry no Compose and nothing of the kit, in their sources or their resolved classpaths;
 *  - any file under a `layout` directory is pure math and names no Compose;
 *  - no source names another module's package without a declared edge, however it spells the reference.
 */
internal object ModuleGuard {
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
    val NO_COMPOSE = setOf("chart-core", "chart-geo-world", "chart-geo-peru")

    // module -> the project dependencies it may declare.
    val EDGES: Map<String, Set<String>> =
        mapOf(
            "chart-core" to emptySet(),
            "chart" to setOf("chart-core", "kit"),
            "chart-stock" to setOf("chart", "chart-plots"),
            "chart-crossfilter" to setOf("chart", "chart-cartesian"),
            "chart-geo-world" to emptySet(),
            "chart-geo-peru" to emptySet(),
        ) + (FAMILIES - setOf("chart-stock", "chart-crossfilter") + "chart-export").associateWith { setOf("chart") }

    private val PACKAGES: Map<String, String> =
        mapOf(
            "com.jcsoftdev.ui.chart.core" to "chart-core",
            "com.jcsoftdev.ui.chart" to "chart",
            "com.jcsoftdev.ui.chart.geo.world" to "chart-geo-world",
            "com.jcsoftdev.ui.chart.geo.peru" to "chart-geo-peru",
        ) + (FAMILIES + "chart-export").associate { "com.jcsoftdev.ui.${it.replace('-', '.')}" to it }

    private val REFERENCE = Regex("""com\.jcsoftdev\.ui\.[A-Za-z0-9_.]*[A-Za-z0-9_]""")
    private val PACKAGE = Regex("""(?m)^package\s+([\w.]+)""")

    // The longest package prefix wins, so chart.geo.world is the data artifact and not the geo family.
    fun moduleOfPackage(name: String): String? =
        PACKAGES.entries
            .filter { (prefix, _) -> name == prefix || name.startsWith("$prefix.") }
            .maxByOrNull { it.key.length }
            ?.value

    private fun reachable(module: String): Set<String> {
        val seen = mutableSetOf(module)
        val queue = ArrayDeque(listOf(module))
        while (queue.isNotEmpty()) EDGES[queue.removeFirst()].orEmpty().forEach { if (seen.add(it)) queue.add(it) }
        return seen
    }

    /** Violations of one main-source file, whole text scanned: imports, aliases, wildcards, qualified names and comments alike. */
    fun sourceViolations(
        module: String,
        relativePath: String,
        text: String,
    ): List<String> {
        val violations = mutableListOf<String>()
        val permitted = reachable(module)
        PACKAGE.find(text)?.groupValues?.get(1)?.let {
            if (moduleOfPackage(it) != module) violations += "$relativePath declares package $it, which is not $module's"
        }
        REFERENCE.findAll(text).map { it.value }.toSet().forEach { name ->
            val target = moduleOfPackage(name)
            when {
                target == null && module in NO_COMPOSE -> violations += "$relativePath names $name, outside the chart modules"
                target != null && target !in permitted -> violations += "$relativePath names $name from $target, not an edge of $module"
            }
        }
        val pure = module in NO_COMPOSE || relativePath.split('/', '\\').dropLast(1).contains("layout")
        if (pure) {
            listOf("androidx.compose", "org.jetbrains.compose").filter { it in text }.forEach {
                violations += "$relativePath names $it, but pure chart math carries no Compose"
            }
        }
        return violations
    }

    /** Violations in the resolved-graph report written by writeModuleGraph for one module. */
    fun graphViolations(
        module: String,
        report: String,
    ): List<String> {
        val violations = mutableListOf<String>()
        val blocks = report.split("config ").drop(1).associate { block -> block.substringBefore('\n') to block.lines().drop(1) }
        listOf("jvmRuntimeClasspath", "releaseRuntimeClasspath").forEach {
            if (it !in blocks) violations += "$module: the report has no $it"
        }
        val allowed = EDGES.getValue(module).map { ":$it" }.toSet()
        blocks.forEach { (configuration, lines) ->
            val projects = lines.filter { it.startsWith("direct project ") }.map { it.removePrefix("direct project ") }.toSet()
            if (projects != allowed) violations += "$module/$configuration depends on $projects, the graph allows $allowed"
            if (module in NO_COMPOSE) {
                lines
                    .filter { it.startsWith("all module ") }
                    .map { it.removePrefix("all module ") }
                    .filter { it.startsWith("org.jetbrains.compose") || it.startsWith("androidx.compose") }
                    .forEach { violations += "$module/$configuration resolves Compose artifact $it" }
            }
        }
        return violations
    }
}
