import org.gradle.api.DefaultTask
import org.gradle.api.artifacts.component.ModuleComponentIdentifier
import org.gradle.api.artifacts.component.ModuleComponentSelector
import org.gradle.api.artifacts.component.ProjectComponentSelector
import org.gradle.api.artifacts.result.ResolvedComponentResult
import org.gradle.api.artifacts.result.ResolvedDependencyResult
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.provider.MapProperty
import org.gradle.api.tasks.Internal
import org.gradle.api.tasks.OutputFile
import org.gradle.api.tasks.TaskAction

/**
 * Writes the dependency graph Gradle actually resolved for a module, per classpath: its direct edges (project or external module)
 * and every component reachable from it. The module-graph test reads this instead of parsing build files, so a dependency added
 * through any spelling (a variable, a convention, a version catalog bundle, a source set) is seen. It always runs: the
 * resolution is the input, and the test task re-runs only when this file's text changes.
 */
abstract class WriteModuleGraph : DefaultTask() {
    @get:Internal
    abstract val roots: MapProperty<String, ResolvedComponentResult>

    @get:OutputFile
    abstract val report: RegularFileProperty

    init {
        outputs.upToDateWhen { false }
    }

    @TaskAction
    fun write() {
        val lines = mutableListOf<String>()
        roots.get().toSortedMap().forEach { (configuration, root) ->
            lines += "config $configuration"
            root.dependencies
                .filterIsInstance<ResolvedDependencyResult>()
                .mapNotNull { edge ->
                    when (val requested = edge.requested) {
                        is ProjectComponentSelector -> "direct project ${requested.projectPath}"
                        is ModuleComponentSelector -> "direct module ${requested.group}:${requested.module}"
                        else -> null
                    }
                }.toSortedSet()
                .forEach { lines += it }
            val seen = mutableSetOf<String>()
            val queue = ArrayDeque(listOf(root))
            while (queue.isNotEmpty()) {
                val component = queue.removeFirst()
                val id = component.id
                if (id is ModuleComponentIdentifier) seen += "all module ${id.group}:${id.module}"
                component.dependencies.filterIsInstance<ResolvedDependencyResult>().forEach { edge ->
                    if (seen.add("visit ${edge.selected.id.displayName}")) queue.add(edge.selected)
                }
            }
            seen.filter { it.startsWith("all ") }.sorted().forEach { lines += it }
        }
        report.get().asFile.apply {
            parentFile.mkdirs()
            writeText(lines.joinToString("\n", postfix = "\n"))
        }
    }
}
