pluginManagement {
    includeBuild("build-logic")
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "ui-compose"

include(":kit", ":sample", ":baselineprofile", ":size-probe", ":bom")

// One Maven artifact per chart family, never per chart: an app pays only for the families it names.
// Every module is registered here once so later batches add code without touching a shared Gradle file.
val chartModules =
    listOf(
        "chart-core",
        "chart",
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
        "chart-geo-world",
        "chart-geo-peru",
        "chart-export",
    )
chartModules.forEach { name ->
    include(":$name")
    project(":$name").projectDir = file("charts/$name")
}
