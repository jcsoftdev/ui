plugins {
    id("jcsoftdev.kmp.compose-library")
}

description = "Chart foundation for Compose: frame, state, hover and pin, dock, tooltip, legend and accessibility."

kotlin {
    sourceSets {
        commonMain.dependencies {
            api(project(":chart-core"))
            api(project(":kit"))
        }
    }
}

// ChartModuleGraphTest guards every chart module, so the test task declares what it reads: the resolved graph each module writes,
// their sources and build files, settings and the catalog. Without these inputs the build cache would replay a stale pass.
val chartProjects = provider { rootProject.subprojects.filter { it.path.startsWith(":chart") } }
tasks.named<Test>("jvmTest") {
    dependsOn(provider { chartProjects.get().map { "${it.path}:writeModuleGraph" } })
    inputs
        .files(
            provider {
                chartProjects.get().map {
                    it.layout.buildDirectory
                        .file("module-graph.txt")
                        .get()
                        .asFile
                }
            },
        ).withPropertyName("moduleGraphs")
        .withPathSensitivity(PathSensitivity.RELATIVE)
    inputs
        .files(
            rootProject.fileTree("charts") {
                include("*/build.gradle.kts", "*/src/**/*.kt")
            },
            rootProject.file("settings.gradle.kts"),
            rootProject.file("gradle/libs.versions.toml"),
        ).withPropertyName("chartDefinitions")
        .withPathSensitivity(PathSensitivity.RELATIVE)
    systemProperty("chart.root", rootProject.projectDir.absolutePath)
}
